new Vue({
    el: '#app',
    data: {
        counts: 0,
        nfts: [],
        centralized: 0,
        decentralized: 0,
        page: 0,
        chunked: [],
        contract: "",
        contracts: {},
        percentage: 0
    },
    async mounted() {
        const app = this
        app.getData()
        setInterval(function () {
            app.getData()
        }, 30000)
    },
    methods: {
        async getData() {
            const app = this
            let nfts = await window.axios.get('/nfts')
            app.counts = nfts.data.length
            app.nfts = nfts.data
            for (let k in app.nfts) {
                if (app.nfts[k].tokenURI.indexOf('ipfs') !== -1) {
                    app.decentralized++
                } else {
                    app.centralized++
                }
            }
            app.percentage = (app.decentralized / app.counts * 100).toFixed(2)
            app.chunked = app.chunk(app.nfts, 10)

            let contractsDB = await window.axios.get('/contracts')
            let contracts = {}
            for (let k in contractsDB.data) {
                contracts[contractsDB.data[k].smart_contract] = contractsDB.data[k]
            }
            app.contracts = contracts
        },
        chunk(arr, size) {
            let chunked = []
            let i = 0
            let n = 0
            for (let k in arr) {
                if (chunked[i] === undefined) {
                    chunked[i] = []
                }
                if (n < size) {
                    chunked[i].push(arr[k])
                    n++
                } else {
                    i++
                    chunked[i] = []
                    chunked[i].push(arr[k])
                    n = 1
                }
            }
            return chunked
        },
        addPage() {
            const app = this
            let next = app.page + 1
            if (app.chunked[next] !== undefined) {
                app.page = next
            }
        },
        removePage() {
            const app = this
            let prev = app.page - 1
            if (app.chunked[prev] !== undefined) {
                app.page = prev
            }
        },
        async checkContract() {
            const app = this
            if (app.contract !== "") {
                let check = await window.axios.get('/track/' + app.contract)
                if (check.data.indexOf('yet') !== -1) {
                    let nfts = await window.axios.get('/contract/' + app.contract)
                    app.nfts = nfts.data
                    app.counts = nfts.data.length
                    app.centralized = 0
                    app.decentralized = 0
                    for (let k in app.nfts) {
                        if (app.nfts[k].tokenURI.indexOf('ipfs') !== -1) {
                            app.decentralized++
                        } else {
                            app.centralized++
                        }
                    }
                    app.chunked = app.chunk(app.nfts, 10)
                    app.page = 0
                } else {
                    alert('We\'re not tracking this smart contract but we queued the download, please grab a coffee and came back later!')
                }
            } else {
                alert('Insert a valid URL or Smart Contract address')
            }
        },
        async resetSearch() {
            const app = this
            this.contract = ""
            let nfts = await window.axios.get('/nfts')
            app.counts = nfts.data.length
            app.centralized = 0
            app.decentralized = 0
            app.nfts = nfts.data
            for (let k in app.nfts) {
                if (app.nfts[k].tokenURI.indexOf('ipfs') !== -1) {
                    app.decentralized++
                } else {
                    app.centralized++
                }
            }
            app.chunked = app.chunk(app.nfts, 10)
        }
    }
})