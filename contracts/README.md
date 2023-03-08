# DC (.country) Smart Contracts

DC contracts have compatible NameRecord structures from [D1DC (.1.country)](https://github.com/polymorpher/.1.country) but function significantly differently. The key differences are:

1. The DC contract itself does not manage domain registrations. All web3 domain ownership, registration, and renewal matters are delegated to ENS contracts deployed by [ENS Deployer](http://github.com/polymorpher/ens-deployer/)
2. Owners of ENS domains can pay a small fee to "reinstate" their records in DC contract. This means if someone purchases an ENS domain through a marketplace (such as an NFT marketplace), they can reclaim corresponding names and records in DC contract, i.e. to take over from previous owner of the ENS domain
3. The DC contract's companion frontend (in `/client` folder) is meant to be used together so the user can rent a web3 and web2 domain simutaneously. 

In other words, the DC contract is meant to provide some "extra service" on top of ENS contracts. Therefore, it charges some additional fees on top of purchasing an ENS domain from the ENS app. On a product level, the main value is to host and configure data that is also viewable in web2. The initial product only allows the renter to embed a tweet on their new domain, but more functionalities are coming soon


