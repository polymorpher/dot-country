# Email Alias Service

The Email Alias Service (EAS) provides .country domain owners email alias addresses which they can privately forward to their existing email addresses.

Example:

1. Buy a .country domain (e.g., fsociety.country)
2. Activate Email Alias Service by setting a forwarding email address (e.g., `mr.robot@gmail.com`)
3. Done! Now you can receive emails at `hello@fsociety.country`. All emails will be secretly forwarded to `mr.robot@gmail.com`

Your forwarding address will remain private. It will not be publicly visible or stored on-chain.  

## Initial Design

The initial version will be implemented using a smart contract to store the activation and commitment from the user. The email forwarding will be performed by [ImprovMX](https://improvmx.com), a web2 email forwarding service. In subsequent versions, we may implement a customized email server interacting with smart contracts to authenticate domain ownership and read mail forwarding rules.

Multiple addresses (in addition to `hello@...`) and regex capturing support (e.g., `([a-z]+)\.([a-z]+)` captured as $1 and $2, a typical pattern for first name and last name in company email accounts) can be added in later versions

### EAS Smart Contract

EAS is activated in a smart contract separate from dot-country (DC). The activation is free but requires the user to own an existing DC domain. During activation, the user needs to provide the following:

1. the SLD (second-level domain) name (e.g., `fscoiety`)
2. the alias to receive email under the user's .country domain, defaults to be `hello` (the initial version will only support a single alias)
3. the commitment hash computed by `keccak256(bytes.concat(alias,"|",forwardAddress,"|",signature))`, where:
   - `forwardAddress` is the destination email address (e.g., `mr.robot@gmail.com`), and 
   - `signature` is the EIP-192 signature produced by the user over a user-friendly message that includes the forwardAddress (e.g., `You are about to authorize forwarding all emails from hello@fsociety.country to mr.robot@gmail.com`)

The smart contract will verify that the user's address indeed owns the domain name under the DC contract, and if so, store the mapping entry of (domain name) -> (alias, commitment hash). EAS can be marked for deactivation by the user at any time. In the initial version, deactivation alone on the smart contract is insufficient to deactivate the service. The EAS server must be notified to complete the deactivation.

#### Necessity of Smart Contract

One may ask why a smart contract is necessary at all for the initial version of EAS - can't we ask the user to sign a message to prove wallet-address ownership, send the signature and configuration to the server, and have the server check the address owns the corresponding DC domain?

The concern here is security and configuration visibility to the user. A hacker could request the user to produce the required signature and mix the request in a series of legitimate requests (e.g., NFT trading, airdrop, defi app). Many unsuspecting users may fall into this trap and unwittingly allows the hacker to hijack their .country emails. The result is that the hacker could configure the user's EAS and intercept all emails meant for the user - it is a major security risk.

By requiring configurations to be committed to the contract, any change would require a contract interaction. It is much harder to mix or spoof compared to signature requests. The user would have more opportunities to review the details. Plus, the user could gain visibility on any change to their EAS configuration. The client could actively monitor for unexpected changes and alert the user if necessary.


### EAS server

EAS server provides APIs for users to complete the activation and deactivation of the service. When an API is called, the EAS server verifies the smart contract's state concerning the corresponding user, domain, and alias before communicating with our DNS server and ImprovMX API to complete the action.

#### APIs

Sever root: `1ns-eas.hiddenstate.xyz`

##### Response Formats

All responses are in JSON. Response codes are below:

- 200 OK: It's working
- 400 Bad Request: Something is wrong with your request parameters. See the `error` field in the response for details
- 401 Unauthorized: Signature verification failed
- 500 Internal Server Error: Please report to us if you see this error, with as much detail as possible, including the entire response and the request


##### Routes

###### Activate an alias for a domain.

```
POST /activate

{
   "alias": "hello",
   "sld": "fsociety",
   "forwardAddress": "mr.robot@gmail.com",
   "signature": "0x123456..."
}

```

The server checks:

- in the EAS contract, the stored commitment hash corresponding to alias and domain (SLD) equals `keccak256(bytes.concat(alias,forwardAddress,signature))`
- in the DC contract, the address of the owner of the domain (SLD) is the signer of the signature, given the message corresponding to alias and forwardingAddress (format shared between EAS server and frontend clients)


###### Deactivate an alias for a domain

```
POST /deactivate

{
   "alias": "hello",
   "sld": "fsociety",
}

```

The server checks that the commitment hash corresponding to the alias and domain (SLD) in the EAS contract is cleared to empty value.


### EAS Client

EAS Client can be in both the command line and web interfaces. Its job is simple: 

- collect three parameters alias, forwardAddress, and domain
- connect with the user's wallet to produce the required signature
- interact with EAS smart contract via the user's wallet to configure EAS
- interact with the EAS server to complete the configurations


