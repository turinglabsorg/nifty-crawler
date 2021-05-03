new Vue({
    el: '#app',
    data: {
        counts: 0,
        nfts: [],
        centralized: 0,
        decentralized: 0,
        page: 1,
        chunked: [],
        contract: "",
        contracts: {},
        percentage: 0,
        onlyDecentralized: false,
        isLoading: false
    },
    async mounted() {
        const app = this
        app.getData()
        setInterval(function () {
            if (app.contract === "" && app.page === 1) {
                app.getData()
            }
        }, 30000)
    },
    methods: {
        async getData() {
            const app = this
            app.isLoading = true
            let nfts = await window.axios.get('/nfts/' + app.page)
            app.counts = nfts.data.count
            app.decentralized = nfts.data.decentralized
            app.centralized = 0
            app.nfts = nfts.data.nfts
            app.percentage = nfts.data.percentage

            let contractsDB = await window.axios.get('/contracts')
            let contracts = {}
            for (let k in contractsDB.data) {
                contracts[contractsDB.data[k].smart_contract] = contractsDB.data[k]
            }
            app.contracts = contracts
            app.isLoading = false
        },
        addPage() {
            const app = this
            let next = app.page + 1
            app.page = next
            if (app.contract === "") {
                app.getData()
            } else {
                app.filterNFTs()
            }
        },
        removePage() {
            const app = this
            let prev = app.page - 1
            if (prev >= 1) {
                app.page = prev
                if (app.contract === "") {
                    app.getData()
                } else {
                    app.filterNFTs()
                }
            }
        },
        async checkContract() {
            const app = this
            if (app.contract !== "") {
                let check = await window.axios.get('/track/' + app.contract)
                alert(check.data)
            }
        },
        async resetSearch() {
            const app = this
            this.contract = ""
            app.counts = 0
            app.centralized = 0
            app.decentralized = 0
            app.page = 0
            app.getData()
        },
        async filterNFTs() {
            const app = this
            if (app.contract !== "") {
                app.isLoading = true
                let nfts = await window.axios.get('/contract/' + app.contract + '/' + app.page)
                app.counts = nfts.data.count
                app.decentralized = nfts.data.decentralized
                app.centralized = 0
                app.nfts = nfts.data.nfts
                app.percentage = nfts.data.percentage
                app.isLoading = false
            } else {
                app.getData()
            }
        },
    }
})