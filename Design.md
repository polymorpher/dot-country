## Overview

The end goal of the [.country TLD project](https://harmonyone.notion.site/country-Top-Level-Domain-5db61512025a4db88114785b4f899d7e) is to simplify domain registration, control, trading, management, and hosting processes, and to transform the user experience, security, reliability, and transparency to the next level using blockchains. Since Web2web2 and Web2Web3web3 domain systems are made interoperable, we have to connect, synchronize, and cross-validate many subsystems so they may work as one. The most important component is arguably the Web2web2 domain registry, and how it should interact with the blockchains and maintain consistent data. A major challenge is to make the complexities of these technologies somewhat invisible to the user. Our system should accommodate domain operations from both Web2web2 and Web2Web3web3 origins, and be able to automatically and verifiably execute the operations in tandem across both systems. We can only expect users to onboard gradually and sparsely interact with our systems. At the same time, we should expect each domain operation to be critical to the user, and our systems must not introduce unexpected delays, concepts, or changes in established user workflow.

In this article, we will use .country TLD as an example, and discuss what needs to be done at the infrastructure level to make the domain system secure and reliable enough, so the benefits and utilities of Web2Web3web3 domain systems can propagate to Web2web2. We will define a simple specification for how a Web2Web3web3-enabled registrar could interact with the registry by extending an existing protocol, so domain operations could be performed efficiently and securely over Web2Web3web3 and stay in sync with Web2web2. In the long term, we aim to build an algorithmically-sound system using blockchain that bridges the gap between Web2Web3web3 and Web2web2, and to make Internet domain systems more efficient, transparent, and accessible, and users could be less reliant on good-faith behaviors from registrars, registries, or regulatory bodies to maintain the systems.[^1]


## Background

Web2Web3 domain systems (e.g. ENS) have been developed without much efforts on interfacing with the Web2web2 systems (i.e. DNS).[^2]  Typical Web2Web3web3 domain (e.g. harmony.eth) can only be resolved to wallet addresses and other records on specific blockchains (e.g. Ethereum or Harmony), given specific deployment addresses. The resolution is typically done over a blockchain enabled web or mobile app, with specific configuration on which deployment is to be used. Anyone can replicate a deployment with modified rules, records, and feature sets, as long as they can convince apps and users to adopt their deployment (e.g. Unstoppable Domain). Users are free to choose any system, but there is no common standard for deployment requirements or metrics to measure the effectiveness of any deployment. Most critically, the Web2Web3web3 domains cannot be automatically resolved in-browser except by a few new browsers (e.g. Brave) using advanced configurations. These limitations are major obstacles towards mass adoption and creating real-world utilities for Web2Web3web3 domain systems.

To bridge the gap, we need to build a new system that automatically synchronizes records in Web2web2 registry with its counterparts in Web2Web3web3 smart contracts, and to have Web2web2 systems interoperate with Web2Web3web3 smart contracts. Using .country TLD as an example, this means the system should register a Web2web2 domain **example.country** when the user purchases a Web2Web3web3 domain **example.country**, and vice versa. When the user transfers, updates, renews the domain **example.country** by either smart contract or a traditional DNS’s registrar, actions should be taken as if the user did so in both the smart contract and the registrar itself (thus updating the registry). Note that matters related to operating nameservers such as setting and synchronizing DNS records via the registrar are outside the scope of this system. It is assumed that we are using a traditional Web2web2 nameserver to manage and resolve DNS records. It is also possible to create a nameserver that interprets DNS records provided by smart contracts on the blockchain, which will be discussed in a separate article.

The first step in building our system is to define what information we need to incorporate to the registry when a new domain is registered, and what registries should do upon receiving the information. This can be done by naively repurposing existing fields in WHOIS information, or more formally, by extending EPP commands (which registrars typically use to communicate with registries).[^3]


## Scope

The first scenario we need to consider is when the user wants to register a second-level domain (e.g. **harmony.country**) via a Web2Web3web3 app (such as [ens.demo.harmony.one](https://ens.demo.harmony.one)). To make the domain name work out-of-the-box for everyone in all standard browsers (without installing browser extensions, or assuming users know how they can interact with smart contracts), we should automatically register the domain in Web2web2 systems (e.g. in **.country** registry) behind the scene, and assign a default nameserver to the domain. The default nameserver may set up some default DNS records for the domain so that a default website can be displayed when people visit the second-level domain, until the user sets their own DNS records. The process should give the user exclusive control and verifiable ownership over the domain such that:



1. no one else can register the domain in any registrar supporting the TLD (e.g. .country)
2. the user may transfer the domain to another registrar if they wish[^4]


3. the user may update contact information associated with the domain via any registrar
4. \* the user may transfer ownership of the domain within the same registrar
5. \* the user may setup common DNS records under this domain (A, CNAME, TXT, MX)

Items 1,2,3 require support at the registry level. Items 4,5 (marked with *) are unrelated to EPP commands and can be implemented at registrar level (using Web2Web3web3 or Web2web2). Another desirable feature is to allow anyone to look up the registry to retrieve and verify Web2Web3web3 registration information related to the domain. This can be done at the registry level by extending some EPP commands, or simply at the registrar level by setting TXT records.

As part of the Web2Web3web3 registration process, the user is assumed to have made payments in cryptocurrency[^5] and passed along the following information to the registrar, which can be relayed to the registry:



* name and contact information of the user themselves, as the registrant
* the user’s wallet address (0x….) and  the chain id of the blockchain for registration
* transaction receipt for the registration (which contains the transaction hash)
* a message, containing the registrar’s id, the transaction receipt id, the fully-qualified domain name registered by the user, and the timestamp of the registration
* a ECDSA signature on the message above, signed by the user’s wallet’s private key


### Other scenarios

In the future, we will consider a scenario where the user registered a domain via a Web2web2 registrar[^6] and the user may or may not have a cryptocurrency wallet. The registry, upon receiving a registration without the expected Web2Web3web3 registration data, should register the same Web2Web3web3 domain on behalf of the registrar and assign the ownership to the designated wallet address[^7]. This can be done via an REST API call to a separate server if the registry cannot implement blockchain interaction on its own. We will discuss the technical details for this scenario in a separate article.


## Technical Details

In the long term our system should be permissionless and trustless, like many other Web2Web3web3 infrastructure. Over time, we expect more people to operate their own registrars under the .country TLD registry using our open systems, or to operate their own registries for other TLD. Unlike Web2web2 counterparts, most transactions in Web2Web3web3 are irreversible. If a registrar gets hacked, the hacker could transfer domains to their own accounts, and our system would automatically transfer the assets (such as NFTs) on-chain accordingly, the consequence could be catastrophic to the Web2Web3web3 ecosystem. As such, we cannot assume the registrars and their affiliates would always act in good-faith, or to optimistically execute transactions, hoping that loss can be recovered or that transactions could be rolled back later after disputes are resolved.

The main problems we want to discuss in this article are:



1. Protocol:
    1. How should we modify the EPP mappings[^8] to embed the information?


    2. In what format should we store Web2Web3web3 ownership information in the registry?
2. Verifiability
    3. How should users query for the Web2Web3web3 information in the registry?
    4. How do we allow other users to verify the correctness and consistency of Web2Web3web3 information stored for any domain in the registry?
3. Security
    5. How do we prevent registrars from submitting incorrect information or perform other malicious behaviors?
    6. How do we prevent front-running attacks? i.e. upon observing a new Web2Web3web3 registration (on-chain), front-run the registrant and register the same Web2web2 domain before the registrant could finalize the Web2web2 registration, or vice-versa.
    7. How can a user manage their domains without being locked-in at any registrar?


### Protocol

We should add the following information to the existing EPP protocol for domain registration:



* **addr**: (20 bytes) the registrant’s wallet address,
* **tx**: (32 bytes) the hash of the transaction confirming domain payment and reservation
* **chainId**:** (**4 bytes) the blockchain’s id, used for **tx** and** addr**
* **regId**: (4 bytes) the registrar’s id (integer, a mapping could be stored at a public ledger)
* **ts**: (4 bytes) timestamp (epoch seconds) of when **sig** is requested (see below)
* **msg**: (32 bytes) a keccak256 hash for a stringified JSON[^9], containing the following fields in the listed order:


    * **addr, tx, chainId, regId, ts**: as specified above
    * **domain**: the fully qualified domain name for registration
* **sig**: (65-bytes) the signature over **msg** by private key of **addr **following [EIP-191](https://eips.ethereum.org/EIPS/eip-191)

With **sig **we can prevent the registrar from forging the domain’s ownership data (**addr**), and enable the registry and third-parties to verify a domain is registered through **tx**[^10] on **chainId** at around time **ts**. Since **regId** is part of the preimage of the signed message, we can affirm this particular registrar gained authorization for registering the domain, and no other registrar can take this signature to perform the action. We also require** ts** to be no more than 10 minutes ago from now, to prevent registrars reusing outdated signatures.

Newer versions of this protocol could add additional fields for version identification. For example, when we have billions of domains registered under this protocol, the 4-byte field for regId is no longer sufficient. At that time, a new version should be designed with 8-byte regId..

In EPP, the registration process is defined in [RFC5731 § 3.2.1](https://www.rfc-editor.org/rfc/rfc5731#section-3.2.1) (&lt;create> command). Here are a few ways we can insert this information as part of this command, following the mapping defined in the RFC (which comes with [XSD definitions](https://github.com/polymorpher/epp-xsd-files/blob/f80f32c097559d74266a69b1ac25c0f39a4d4e19/domain-1.0.xsd#L37)).


#### Option 1: Naively packing the information in existing fields

Per RFC, most XML fields in **&lt;create>** have restricted forms (hence unsuitable for carrying the information above). But two fields have minimal restrictions:: **authInfo **and **contact **(references to separate **contact objects**).

**authInfo** must not be sent to any registrar except the one that manages the domain, which makes it undesirable for verification purposes. Another major issue is authInfo is not configurable in typical domain reseller APIs.

In **contact objects**, multiple fields can be normalized strings up to a length of 255 characters: **name**, **organization**, **street**, **street2 **(second line of street address), and **city**. Among those, **organization** and **street2** are optional hence not often used. In Web2Web3web3 domain registration (such as via ENS), **organization** is typically not asked. Therefore, we may use this field to carry data. Note that the total amount of information we need to pack is 20 + 32 + 4 + 4 + 4 + 32 + 65 = 161 bytes. With base64 encoding, which represents 3 bytes per 4 characters, 161 bytes can be packed into a string of 216 characters, which fits into the **organization** field. Furthermore, reseller APIs typically support providing organization over the API, and such information can be made public. An example of this is [domain purchase API from enom](https://api.enom.com/docs/purchase). The RegistrantOrganizationName field can be populated with our information using a base64 encoding.

There are two downsides of using contact’s organization to fulfill our purpose:



1. Each time when we register a new domain, we will need to create a new contact at the registry database (even though the contact already exists). Doing so may slightly slow down the response time, and create more burden for the registry over time.
2. This is a slight abuse of the intended use of information in contact object, where the object is supposed to store only contact-person’s information, not domain’s information


#### Option 2: Extending &lt;createType>

We can extend the [XSD definitions](https://github.com/polymorpher/epp-xsd-files/blob/f80f32c097559d74266a69b1ac25c0f39a4d4e19/domain-1.0.xsd#L37) in the RFC for creating new domains. To quote from the original definition:


```
<complexType name="createType">
    <sequence>
        <element name="name" type="eppcom:labelType"/>
        <element name="period" type="domain:periodType" minOccurs="0"/>
        <element name="ns" type="domain:nsType" minOccurs="0"/>
        <element name="registrant" type="eppcom:clIDType" minOccurs="0"/>
        <element name="contact" type="domain:contactType" minOccurs="0" maxOccurs="unbounded"/>
        <element name="authInfo" type="domain:authInfoType"/>
    </sequence>
</complexType>
```


We may redefine this field in a separate XSD spec, similar to the [example here](https://github.com/polymorpher/epp-xsd-files/blob/f80f32c097559d74266a69b1ac25c0f39a4d4e19/dkhm-epp-1.0.xsd) where pwType is redefined:


```
<complexType name="Web2Web3web3InfoType">
    <sequence>
        <element name="addr" type="xs:hexBinary" length="20"/>
        <element name="tx" type="xs:hexBinary" length="32"/>
        <element name="chainId" type="xs:unsignedInt"/>
        <element name="regId" type="xs:unsignedInt"/>
        <element name="ts" type="xs:unsignedInt">
        <element name="msg" type="xs:hexBinary" length="32"/>
        <element name="sig" type="xs:hexBinary" length="65"/>
    </sequence>
</complexType>

<redefine schemaLocation="domain-1.0.xsd">
    <complexType name="createType">
        <sequence>
            <element name="name" type="eppcom:labelType"/>
            <element name="period" type="domain:periodType" minOccurs="0"/>
            <element name="ns" type="domain:nsType" minOccurs="0"/>
            <element name="registrant" type="eppcom:clIDType" minOccurs="0"/>
            <element name="contact" type="domain:contactType" minOccurs="0" maxOccurs="unbounded"/>
            <element name="authInfo" type="domain:authInfoType"/>
            <element name="Web2Web3web3Info" type="Web2Web3web3InfoType" minOccurs="0"/>
        </sequence>
    </complexType>
</redefine>
```


To implement this, we need to load the above XSD schema in the registry. The schema would be backward compatible to existing registrars since only a new optional field is defined. Here, the data in Web2Web3**web3Info** should be made publicly available. Other schemas such as infDataType (for EPP command &lt;info>, which queries information related to a domain) should also be redefined to return Web2Web3web3Info (if available) when anyone queries a domain.


#### Verification at Registry

If Web2Web3web3 info is present (via either option described above), the registry should verify that:



* **sig** matches **addr**, given **msg** (using ECDSA public key recover algorithm)
* **regId** matches the registry’s client Id (looking up a public ledger and internal database)
* **ts** is no less than 10 minutes ago
* keccak256 hash of the JSON string of object {**addr**, **tx**, **chainId**, **regId**, **ts**, **domain**} matches **msg**
* **tx** is a valid, completed transaction on **chainId**, where its timestamp is within 10 minutes of **ts**
* **tx** is interacting with the designated (trusted) smart contract address for managing Web2Web3web3 domain registrations
* **domain** is registered in the tx (by verifying events in the logs)
* (optional) payment of no less than an expected amount were completed in **tx **

If any of the above conditions fails, the registry should reject the registration.

The last item is optional because it is the registrar’s responsibility to ensure the user completed the payment, prior to requesting registration at the registry (and paying the registry). The registry does not need to check user payment.

To reduce implementation complexity, the above steps can be packaged in an SDK provided to the registry backend operator, or completed via a single REST API call, where the server is provided and deployed separately.


#### Transferring and updating domains


##### Web2Web3 transfers

The above protocol can be slightly modified to work with domain transfers that occurred in Web2Web3web3. With Option 1, we have to replace the data in the **organization** field, therefore we would be able to store only information about the latest transfer. With Option 2, we can modify Web2Web3**web3Info** to have an unbounded maxOccurance, thus able to record all transfers and the original ownership information from the first registration.

Detailed definitions will be provided as a separate document in the future.


##### Web2 transfers and updating domains

We can further extend authInfo to enable password-less updates across registrars, without trusting any registrar. Because of the flexibility of the authInfo field (defined in the RFC), We can add the user’s wallet address in authInfo, and implement a new schema that requires the user to submit a signature over a special message signed by the wallet address for any update. The registry may check the validity of the signature against the wallet address to authorize transfers and updates regardless of which registrar submits the requests.

We will propose some definitions in future articles.


### Verifiability

If we follow Option 1 for storing the Web2Web3web3 information, the registry must not keep WHOIS information private as otherwise we would lose public verifiability, as no one would be able to query about the registrant’s **organization** field besides the registrar that registered the domain. Most registrars (including affiliates via APIs) offer the option to keep the information public.

If we follow Option 2, we will need to implement a new WHOIS service that extends from existing ones, so to query, parse and display the Web2Web3web3Info fields correctly. The public may follow the same sequence of verifications done by the registry in the section above, and compare it with the on-chain information for consistency and correctness.


### Security

As discussed in the [Protocol section](#bookmark=id.jv0ok2kkyyh3), the registrar is unable to forge any information that bypasses the [verification](#bookmark=id.j5d4dfggm2gi) at the registry (or by the public). Prevention of registrar lock-in is also already addressed in the [previous section](#bookmark=id.btq3p1o88lvq).

The only remaining issue is front-running: since the blockchain is public, how can we prevent a malicious actor from immediately registering a Web2web2 domain (without providing any Web2Web3web3 information) after observing someone purchasing a new Web2Web3web3 domain on-chain?

The solution is simple, but requires some modifications in existing Web2Web3web3 domain registration contracts. The typical ENS smart contract completes a domain registration in two stages (two smart contract calls): (1) commit, where the user reserves a domain name for a small period of time, which prevents others from registering the same during this time period; (2) register, where the user pays for the domain and consumes the earlier commitment.  There is a mandatory minimum wait time between commit and purchase, for blocks to finalize[^11]

We cannot perform the Web2web2 registration before payment (since registrars need to pay the registry to register the domain, and users may spam the registrar). But under this flow, we cannot perform the Web2web2 registration after stage (2) purchase either, since a malicious observer can front-run the user and register the Web2web2 domain before everyone.

Therefore, we need to modify the contract to require payment at the commit stage. The commit stage should not reveal the domain name[^12]. The domain name should only be sent to the backend server of the registrar, along with information such as **addr**, **ts**, **sig**, **chainId**, **msg**, as defined previously. The payment may be returned to the user after a reasonably long period of time (e.g. 1 hour) if no one consumed the payment. The payment can be consumed by the registrar[^13] after it successfully registers the Web2web2 domain at the registry (success response from EPP &lt;create> command). It is also possible to have the registry consume the payment as well, in a more advanced future design.

After the Web2web2 registration is complete, the registrar backend server may notify the user’s client, and the client may perform the second smart contract call: **register** - which provides the real domain name, and the smart contract logic would be nearly identical to the second stage (purchase) as it is now.


<!-- Footnotes themselves at the bottom. -->
## Notes

[^1]:
Generally, a **Registry** records who owns which second level domain (SLD, e.g. harmony.country) under a TLD (e.g. .country), and any metadata associated with the SLD. **Registrar** is the place where users lookup domain names available for registration, and pay to register those domains. e.g. godaddy.com, name.com. Most registrars are regulated by ICANN, and the process of becoming a registrar is quite complex.any vendors operate as **resellers** of registrars (see for example [enom](http://enom.com), which offers a white-label reseller platform) or use APIs to register domains on behalf of other people (e.g. Namecheap API). In this document, we use the term registrars liberally and make no distinction between  registrars and those affiliated actors.

[^2]:
In ENS, the registry, registrar, and resolvers are smart contracts. Users interact with the registrar and complete the registration via the ENS web app, which connects to their crypto wallets (such as MetaMask). A DNS resolver contract was developed in recent years, along with some proposals of use cases with DNSSEC. But, none of them aim to work with traditional domain registry or registrars.

[^3]:
Technically, we could also implement mechanisms in registries to continuously monitor events emitted on the blockchain, but that approach would introduce too much deviation from how registry currently operates and may raise compliance issues.(i.e. it should not act on its own)

[^4]:

     as they do in standard Web2web2 registrars; if the new registrar does not support Web2Web3web3 systems, our system should remove associated Web2Web3web3 information from smart contracts, such as the domain’s NFT representation, registrar record, and others

[^5]:
by stablecoins such as USDC, or native asset of the blockchain, such as in ONE

[^6]:
the registrar does not make any registration on blockchain

[^7]:
or the registrar’s, if no user wallet address is provided; if the registrar does not have a wallet address, a new wallet can be created with randomly generated private key

[^8]:

     As defined in various RFCs, summarized in [epp-xsd-files](https://github.com/polymorpher/epp-xsd-files) repository (made by DK-hostmaster)

[^9]:

     JSON is used because it is more human readable and the field is hashed during transmission

[^10]:
Note that the smart contract addresses of on-chain registrar and registry can be further retrieved using information contained in tx (e.g. RegistrarController’s contract address, where the registration takes place)

[^11]:
block time * 4 by default, possibly to accommodate the proof-of-work consensus which Ethereum used to operate in until recently. On blockchains with fast finality, this can be simply set to the block time or shorter

[^12]:
e.g. the hash of the domain name can be committed, so no one else can commit the same domain

[^13]:
the operator wallet account loaded in backend server, not the registry smart contract
