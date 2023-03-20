import * as dotenv from 'dotenv'
const debug = (process.env.DEBUG === '1') || process.env.DEBUG === 'true'
dotenv.config()

export default {
  debug,
  // Deployer
  multisig: process.env.MULTISIG_ACCOUNT as string,

  // Tweet only
  baseRentalPrice: process.env.BASE_RENTAL_PRICE_ETH || '10',
  revenueAccount: process.env.REVENUE_ACCOUNT as string,
  dc: process.env.DC_CONTRACT,

  // DC
  registrarController: process.env.REGISTRAR_CONTROLLER as string,
  nameWrapper: process.env.NAME_WRAPPER as string,
  registrar: process.env.REGISTRAR as string,
  duration: parseFloat(process.env.DURATION_DAYS || '90'),
  resolver: process.env.RESOLVER as string,
  reverseRecord: process.env.REVERSE_RECORD === 'true',
  fuses: parseInt(process.env.FUSES || '0'),
  initialRecordFile: process.env.INITIAL_RECORD_FILE
}
