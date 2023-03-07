import * as dotenv from 'dotenv'
const debug = (process.env.DEBUG === '1') || process.env.DEBUG === 'true'
dotenv.config()

export default {
  debug,
  baseRentalPrice: process.env.BASE_RENTAL_PRICE_ETH || '10',
  revenueAccount: process.env.REVENUE_ACCOUNT,
  registrarController: process.env.REGISTRAR_CONTROLLER,
  nameWrapper: process.env.NAME_WRAPPER,
  dc: process.env.DC_CONTRACT,
  registrar: process.env.REGISTRAR,
  duration: parseFloat(process.env.DURATION_DAYS || '90'),
  resolver: process.env.RESOLVER,
  reverseRecord: process.env.REVERSE_RECORD || true,
  fuses: parseInt(process.env.FUSES || '0'),
  initialRecordFile: process.env.INITIAL_RECORD_FILE
}
