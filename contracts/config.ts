import * as dotenv from 'dotenv'
const debug = (process.env.DEBUG === '1') || process.env.DEBUG === 'true'
dotenv.config()

export default {
  debug,
  baseRentalPrice: process.env.BASE_RENTAL_PRICE_ETH || '1',
  revenueAccount: process.env.REVENUE_ACCOUNT,
  registrarController: process.env.REGISTRAR_CONTROLLER || '0x8De3BeF9ad3C1DF3816f62567Ead61378864572a',
  nameWrapper: process.env.NAME_WRAPPER || '0xe3B2566ff5823ad51397460f5bcFAecE183B50BE',
  dc: process.env.DC_CONTRACT || '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
  registrar: process.env.REGISTRAR || '0x2E44a57dB0bF4F2FaaC4D6332c17Ef74AC62afD3',
  duration: parseFloat(process.env.DURATION_DAYS || '365'),
  gracePeriod: parseFloat(process.env.GRACE_PERIOD || '90'),
  resolver: process.env.RESOLVER || '0xCaA29B65446aBF1A513A178402A0408eB3AEee75',
  reverseRecord: process.env.REVERSE_RECORD || true,
  fuses: parseInt(process.env.FUSES || '0'),
  initialRecordFile: process.env.INITIAL_RECORD_FILE
}
