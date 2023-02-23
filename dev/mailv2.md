# EAS Dev Notes

## Self-hosted Mail Server

We should move away from ImprovMX and host our own mail servers. Ideally, we can select one of the existing open source mail server solutions and build a blockchain-plugin for that for reading configuration and data on-chain, similar to what we did for hosting our own DNS server using CoreDNS. Here are a few options to consider:

- https://github.com/iredmail/iRedMail
- https://github.com/hmailserver/hmailserver
- https://github.com/haraka/Haraka
- https://github.com/modoboa

The list is just a result of 15-minute search. Please feel free to add more and contribute some comparative analysis

## Encrypted Mail

We could generate a key-pair for EAS user, and have the public key committed to EAS contract. We can implement something on our mail server such that all mails will be encrypted using the public key (if the user opts in), so only the user who holds the private key may decrypt and view the emails. It is hard to make this work for existing wallets (such as MetaMask), since the private key is not exposed and there is generally no "decrypt" API offered by the wallet. However, we may be able to add this as an interesting feature to SMS Wallet, since the private key is readily available in the local store.
