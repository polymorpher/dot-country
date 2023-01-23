const debug = process.env.DEBUG

const config = {
  debug,
  contract: process.env.CONTRACT || (debug ? '0x9BC52FBcCcde8cEADAEde51a25dBeD489b201e53' : '0x476e14D956dca898C33262aecC81407242f8431A'),
  resolver: process.env.RESOLVER || (debug ? '0x857cA8e4333497059211003fAae778D4348Fda6a' : '0xB3feaa6EA01780d03aE3D341BF5444b698810495'),
  explorer: process.env.EXPLORER_URL || 'https://explorer.harmony.one/#/tx/{{txId}}',
  defaultRPC: process.env.DEFAULT_RPC || 'https://api.harmony.one',
  defaultDuration: parseInt(process.env.DEFAULT_DURATION) || 365 * 3600 * 24,
  registrarRelayer: process.env.REGISTRAR_RELAYER || 'https://1ns-registrar-relayer.hiddenstate.xyz',
  tld: process.env.TLD || '.country',
  tldHub: process.env.TLD_HUB || 'names.country',
  tldExample: process.env.TLD_EXAMPLE || 'opendevelopment.country',
  chainParameters: process.env.CHAIN_PARAMETERS
    ? JSON.parse(process.env.CHAIN_PARAMETERS)
    : {
        chainId: '0x63564C40', // A 0x-prefixed hexadecimal string
        chainName: 'Harmony Mainnet Shard 0',
        nativeCurrency: {
          name: 'ONE',
          symbol: 'ONE',
          decimals: 18
        },
        rpcUrls: ['https://api.harmony.one'],
        blockExplorerUrls: ['https://explorer.harmony.one/']
      }
}

export default config
