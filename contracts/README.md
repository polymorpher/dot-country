# DC (.country) Smart Contracts

DC contracts have compatible NameRecord structures from [D1DC (.1.country)](https://github.com/polymorpher/.1.country) but function significantly differently. The key differences are:

1. The DC contract itself does not manage domain registrations. All web3 domain ownership, registration, and renewal matters are delegated to ENS contracts deployed by [ENS Deployer](http://github.com/polymorpher/ens-deployer/)
2. Owners of ENS domains can pay a small fee to "reinstate" their records in DC contract. This means if someone purchases an ENS domain through a marketplace (such as an NFT marketplace), they can reclaim corresponding names and records in DC contract, i.e. to take over from previous owner of the ENS domain
3. The DC contract's companion frontend (in `/client` folder) is meant to be used together so the user can rent a web3 and web2 domain simutaneously. 

In other words, the DC contract is meant to provide some "extra service" on top of ENS contracts. Therefore, it charges some additional fees on top of purchasing an ENS domain from the ENS app. On a product level, the main value is to host and configure data that is also viewable in web2. The initial product only allows the renter to embed a tweet on their new domain, but more functionalities are coming soon


## March 3rd, 2023 - Enhancements

**Metadata Standards**

To visualize domain NFTs, we need to do these:

**0. Create a minimum metadata template for the NFT, example:**

```json
{
"attributes": [
	{
		"trait_type": "Agility",
		"value": 9,
		"max_value": 10
	}
],
"description": "Mechanics ensure the function of ships, equipment, and energy harnessing devices.",
"name": "MEC #7000026",
"external_url": "https://gama.io/crew/507000026",
"image": "ipfs://QmRMM4PH12ayX5sbwpJaNuWreC9skgomDuMSw2s4WFhTDs/507000026.jpg",
}
```

I removed some irrelevant properties. Attributes can be something like 

- domain length,
- registration date,
- expiration date,
- activated services,
- special privileges.

You guys can think of something creative. Consult [https://docs.opensea.io/docs/metadata-standards#attributes](https://docs.opensea.io/docs/metadata-standards#attributes)  for reference. There is no guarantee that other marketplaces implemented this standard or even display the attributes. Initially, rather than using IPFS, the images and metadata can be kept on Google Storage

**1. Create a contract that implements the following interface**

```jsx
interface IMetadataService {
	function uri(uint256) external view returns (string memory);
}
```

Where the argument is the uint256 representation of the namehash of the domain. Usually, this is implemented using a baseUrl concatenated with the token id. See [https://github.com/OpenZeppelin/openzeppelin-contracts/blob/eedca5d873a559140d79cc7ec674d0e28b2b6ebd/contracts/token/ERC721/ERC721.sol#L93](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/eedca5d873a559140d79cc7ec674d0e28b2b6ebd/contracts/token/ERC721/ERC721.sol#L93)  for example

**2. Modify BaseRegistrarImplementation contract**

1. make it inherit for [ERC721Enumerable](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC721/extensions/ERC721Enumerable.sol), and 
2. implement override functions for _baseURI, as well as admin functions for managing it

**3. Implement an admin batch minting** (initialization/registration) function in BaseRegistrarImplementation that can be only called once, similar to [https://github.com/harmony-one/dot-country/blob/eee6967b4a51589da0d6d22dbde61b8a928ee3e8/contracts/contracts/DC.sol#L93](https://github.com/harmony-one/dot-country/blob/eee6967b4a51589da0d6d22dbde61b8a928ee3e8/contracts/contracts/DC.sol#L93) 

**4. Migration and deployment (with batch initialization) scripts**, similar to [https://github.com/harmony-one/dot-country/blob/main/contracts/scripts/dump.ts](https://github.com/harmony-one/dot-country/blob/main/contracts/scripts/dump.ts)  and [https://github.com/harmony-one/dot-country/blob/eee6967b4a51589da0d6d22dbde61b8a928ee3e8/contracts/deploy/00_deploy_DC.ts#L39](https://github.com/harmony-one/dot-country/blob/eee6967b4a51589da0d6d22dbde61b8a928ee3e8/contracts/deploy/00_deploy_DC.ts#L39) 

**5**. **A small script  that generates the NFT image**

(ideally inside a node.js express server with a simple API) that generates the NFT image, by overlaying domain name over the background image, and uploading to a designated Google Storage bucket location (set in .env)

1. **Meanwhile, we should also look for ways to simplify DC contract by** 
    1. exposing an ownerOf function and 
    2. delegating ownership data storage to the connected BaseRegistrar and NameWrapper, instead of storing renter explicitly. 
    3. Most methods in DC can be deleted