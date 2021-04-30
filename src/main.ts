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
const express = require('express')
const app = express()
const port = 3000
let isParsing = false

const NFT = mongoose.model('NFT', {
  smart_contract: String,
  tokenID: String,
  tokenURI: String,
  metadata: Object,
  filetype: Object,
  timestamp: Number
});

const Track = mongoose.model('track', {
  smart_contract: String,
  name: String,
  symbol: String,
  timestamp: Number
});

function run(smartcontract_address) {
  return new Promise(async response => {
    isParsing = true
    if (smartcontract_address !== undefined) {
      console.log('Starting parse of ' + smartcontract_address)

      const provider = new HDWalletProvider(
        "announce room limb pattern dry unit scale effort smooth jazz weasel alcohol",
        "https://eth-mainnet.alchemyapi.io/v2/" + NODE_API_KEY
      );
      const web3Instance = new web3(provider);
      const nftContract = new web3Instance.eth.Contract(
        STANDARD_ABI,
        smartcontract_address,
        { gasLimit: "10000000" }
      );

      console.log('|* CONTRACT DETAILS *|')
      let name = ""
      let symbol = ""
      let contractURI = ""
      let contractDB = await Track.findOne({ smart_contract: smartcontract_address })
      try {
        name = await nftContract.methods.name().call();
        contractDB.name = name
      } catch (e) {
        console.log('ERROR WHILE CATCHING NAME')
      }
      try {
        symbol = await nftContract.methods.symbol().call();
        contractDB.symbol = symbol
      } catch (e) {
        console.log('ERROR WHILE CATCHING SYMBOL')
      }
      try {
        contractURI = await nftContract.methods.contractURI().call();
      } catch (e) {
        console.log('ERROR WHILE CATCHING CONTRACT URI')
      }
      console.log('>', name, symbol, '<')
      contractDB.save()
      if (contractURI !== "") {
        console.log('Contract URI is', contractURI)
      }

      // Check if exists files folder
      if (!fs.existsSync('./files')) {
        fs.mkdirSync('./files');
      }

      // Check if exists contract folder
      if (!fs.existsSync('./files/' + smartcontract_address)) {
        fs.mkdirSync('./files/' + smartcontract_address);
      }

      const latest = await web3Instance.eth.getBlockNumber()

      let fromBlock = latest
      let toBlock = latest
      let finished = false
      let max = 999999

      while (!finished) {
        fromBlock = toBlock - max
        if (fromBlock < 0) {
          fromBlock = 0
          finished = true
        }
        console.log('Analyzing from ' + fromBlock + ' / ' + toBlock)
        let result = await analyze(fromBlock, toBlock, nftContract, smartcontract_address)
        if (result === false) {
          let loweringpercent = max / 100 * 30
          max = parseInt((max - loweringpercent).toFixed(0))
        } else {
          max = 999999
          toBlock = fromBlock
        }
      }
      response(true)
    } else {
      response(false)
    }
  })
}

function analyze(from, to, nftContract, smartcontract_address) {
  return new Promise(async response => {
    nftContract.getPastEvents('Transfer', {
      fromBlock: from,
      toBlock: to
    }, async function (error, events) {
      if (!error) {
        for (var i = 0; i < events.length; i++) {
          console.log('Parsing tokenId: ' + events[i].returnValues.tokenId)
          const check = await NFT.findOne({ tokenID: events[i].returnValues.tokenId, smart_contract: smartcontract_address })
          if (check === null) {
            const uri = await nftContract.methods.tokenURI(events[i].returnValues.tokenId).call();
            let exploded = uri.split('/')
            let last = exploded.length - 1
            let tokenFolder = exploded[last]
            // Check if exists token folder
            if (!fs.existsSync('./files/' + smartcontract_address + '/' + tokenFolder)) {
              fs.mkdirSync('./files/' + smartcontract_address + '/' + tokenFolder);
            }
            console.log('Downloading metadata file...')

            let metadata
            try {
              metadata = await axios.get(uri, {
                responseType: 'arraybuffer'
              })
            } catch (e) {
              console.log('Metadata not found at ' + uri + ', LOL')
            }
            // console.log(metadata.data)
            if (metadata !== undefined && metadata.data !== undefined) {
              console.log('Metadata downloaded correctly!')

              // Check if exists metadata json
              if (!fs.existsSync('./files/' + smartcontract_address + '/' + tokenFolder) + '/nft.json') {
                fs.writeFileSync('./files/' + smartcontract_address + '/' + tokenFolder + '/nft.json', metadata.data)
              }
              let md = JSON.parse(Buffer.from(metadata.data).toString())
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
                  if (ft === undefined) {
                    ft = { ext: '.jpg' }
                  }
                  if (!fs.existsSync('./files/' + smartcontract_address + '/' + tokenFolder + '/' + tokenFolder + '.' + ft.ext)) {
                    fs.writeFileSync('./files/' + smartcontract_address + '/' + tokenFolder + '/' + tokenFolder + '.' + ft.ext, image.data)
                  }

                  // Saving in DB
                  console.log('Saving in DB')
                  const nft = new NFT({
                    smart_contract: smartcontract_address,
                    tokenID: events[i].returnValues.tokenId,
                    tokenURI: uri,
                    metadata: md,
                    filetype: ft,
                    timestamp: new Date().getTime()
                  });
                  await nft.save()
                }
              }
            }
          } else {
            console.log('Skipping ' + check.tokenURI)
          }
        }
        response(true)
        console.log('ENDED PARSING')
      } else {
        response(false)
        console.log('PARSING ERROR, TOO EVENTS')
      }
    })
  })
}

async function daemon() {
  console.log('Daemon is starting.')
  const toTrack = await Track.find().sort({ timestamp: -1 })
  for (let k in toTrack) {
    await run(toTrack[k].smart_contract)
  }
  console.log('All finished, waiting 30s then restart.')
  setTimeout(function () {
    daemon()
  }, 30000)
}

daemon()

// Public API
app.get('/track/:smart_contract', async (req, res) => {
  if (req.params.smart_contract.indexOf('0x') !== -1) {
    let split = req.params.smart_contract.split('/')
    let contract = ""
    for (let k in split) {
      if (split[k].indexOf('0x') !== -1) {
        contract = split[k].trim()
      }
    }
    if (contract !== "") {
      const check = await Track.findOne({ smart_contract: contract })
      if (check === null) {
        const track = new Track({
          smart_contract: contract,
          timestamp: new Date().getTime()
        });
        await track.save()
        res.send('Smart contract added to tracker.')
      } else {
        res.send('Smart contract exists yet.')
      }
    } else {
      res.send('Malformed request')
    }
  } else {
    res.send('Malformed request')
  }
})

app.get('/untrack/:smart_contract', async (req, res) => {
  const check = await Track.findOne({ smart_contract: req.params.smart_contract })
  if (check !== null) {
    await Track.deleteOne({ smart_contract: req.params.smart_contract })
    res.send('Smart contract deleted from tracker.')
  } else {
    res.send('Smart contract not tracked.')
  }
})

app.get('/contracts', async (req, res) => {
  console.log(req.headers.host)
  let unique = []
  let response = []
  const contracts = await Track.find()
  for (let k in contracts) {
    let sc = contracts[k].smart_contract.trim()
    if (unique.indexOf(sc) === -1) {
      unique.push(sc)
      response.push(contracts[k])
    }
  }
  res.send(response)
})

app.get('/contract/:smart_contract', async (req, res) => {
  let split = req.params.smart_contract.split('/')
  let contract = ""
  for (let k in split) {
    if (split[k].indexOf('0x') !== -1) {
      contract = split[k]
    }
  }
  const NFTs = await NFT.find({ smart_contract: contract })
  res.send(NFTs)
})

app.get('/nfts', async (req, res) => {
  console.log(req.headers.host)
  const NFTs = await NFT.find().sort({ timestamp: -1 })
  res.send(NFTs)
})

app.use(express.static('files'))

app.listen(port, () => {
  console.log(`Erc721 Parser listening at http://localhost:${port}`)
})