var argv = require('minimist')(process.argv.slice(2));
require('dotenv').config()
const HDWalletProvider = require("truffle-hdwallet-provider");
const web3 = require("web3");
const STANDARD_ABI = require('../abi.json')
const ethers = require('ethers');
const NODE_API_KEY = process.env.ALCHEMY_KEY;
const axios = require('axios')
const fs = require('fs')
const FileType = require('file-type');
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_CONNECTION, { useNewUrlParser: true, useUnifiedTopology: true });

let smartcontract_address

if (process.env.SMARTCONTRACT_ADDRESS !== undefined) {
  smartcontract_address = process.env.SMARTCONTRACT_ADDRESS
}

if (argv.s !== undefined) {
  smartcontract_address = argv.s
}

const NFT = mongoose.model('NFT', {
  smart_contract: String,
  tokenID: String,
  tokenURI: String,
  metadata: Object,
  filetype: Object
});

async function run() {
  if (smartcontract_address !== undefined) {
    console.log('Starting parse of ' + smartcontract_address)
  } else {
    console.log('Must set a smart contract address first.')
  }
  const network = "mainnet";
  const mnemonic = await ethers.HDNode.entropyToMnemonic(ethers.utils.randomBytes(16));
  const provider = new HDWalletProvider(
    mnemonic,
    "https://eth-" + network + ".alchemyapi.io/v2/" + NODE_API_KEY
  );
  const web3Instance = new web3(provider);
  const nftContract = new web3Instance.eth.Contract(
    STANDARD_ABI,
    smartcontract_address,
    { gasLimit: "10000000" }
  );
  const name = await nftContract.methods.name().call();
  const symbol = await nftContract.methods.symbol().call();
  const owner = await nftContract.methods.owner().call();
  const contractURI = await nftContract.methods.contractURI().call();
  console.log('|* CONTRACT DETAILS *|')
  console.log('>', name, symbol, owner, '<')
  console.log('Contract URI is', contractURI)
  let ended = false
  let i = 1;
  // Check if exists files folder
  if (!fs.existsSync('./files')) {
    fs.mkdirSync('./files');
  }

  // Check if exists contract folder
  if (!fs.existsSync('./files/' + smartcontract_address)) {
    fs.mkdirSync('./files/' + smartcontract_address);
  }

  try {
    while (!ended) {
      const owner = await nftContract.methods.ownerOf(i).call();
      const uri = await nftContract.methods.tokenURI(i).call();

      // Check if exists token folder
      if (!fs.existsSync('./files/' + smartcontract_address + '/' + uri.replace('https://ipfs.io/ipfs/', ''))) {
        fs.mkdirSync('./files/' + smartcontract_address + '/' + uri.replace('https://ipfs.io/ipfs/', ''));
      }
      console.log(uri, 'OWNER IS', owner)
      console.log('Downloading metadata file...')
      let metadata = await axios.get(uri, {
        responseType: 'arraybuffer'
      })
      // console.log(metadata.data)
      if (metadata.data !== undefined) {
        console.log('Metadata downloaded correctly!')

        // Check if exists metadata json
        if (!fs.existsSync('./files/' + smartcontract_address + '/' + uri.replace('https://ipfs.io/ipfs/', '')) + '/nft.json') {
          fs.writeFileSync('./files/' + smartcontract_address + '/' + uri.replace('https://ipfs.io/ipfs/', '') + '/nft.json', metadata.data)
        }
        let md = JSON.parse(Buffer.from(metadata.data).toString())

        const check = await NFT.findOne({ tokenURI: uri, smart_contract: smartcontract_address })
        if (check === null) {
          if (md.image !== undefined) {
            console.log('Downloading media file...')
            let image = await axios.get(md.image, {
              responseType: 'arraybuffer'
            })
            if (image.data !== undefined) {
              console.log('Image downloaded correctly!')
              let ft = await FileType.fromBuffer(image.data)
              console.log('File type is: ', ft)
              // Check if exists image file
              if (!fs.existsSync('./files/' + smartcontract_address + '/' + uri.replace('https://ipfs.io/ipfs/', '')) + '/' + uri.replace('https://ipfs.io/ipfs/', '') + '.' + ft.ext) {
                fs.writeFileSync('./files/' + smartcontract_address + '/' + uri.replace('https://ipfs.io/ipfs/', '') + '/' + uri.replace('https://ipfs.io/ipfs/', '') + '.' + ft.ext, image.data)
              }

              // Saving in DB
              console.log('Saving in DB')
              const nft = new NFT({
                smart_contract: smartcontract_address,
                tokenID: i,
                tokenURI: uri,
                metadata: md,
                filetype: ft
              });
              await nft.save()
            }
          }
        } else {
          console.log('Skipping ' + uri)
        }
      }
      i++
    }
  } catch (e) {
    console.log(e)
    ended = true
  }
  process.exit();
}

run()