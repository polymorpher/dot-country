import * as dotenv from 'dotenv'
const debug = (process.env.DEBUG === '1') || process.env.DEBUG === 'true'
dotenv.config()

export default {
  debug,
  baseRentalPrice: process.env.BASE_RENTAL_PRICE_ETH || '1',
  priceMultiplier: parseInt(process.env.PRICE_MULTIPLIER || '2'),
  revenueAccount: process.env.REVENUE_ACCOUNT,
  registrarController: process.env.REGISTRAR_CONTROLLER || '0x8De3BeF9ad3C1DF3816f62567Ead61378864572a',
  registrar: process.env.REGISTRAR || '0x2E44a57dB0bF4F2FaaC4D6332c17Ef74AC62afD3',
  duration: parseFloat(process.env.DURATION || '365'),
  resolver: process.env.RESOLVER || '0xCaA29B65446aBF1A513A178402A0408eB3AEee75',
  reverseRecord: process.env.REVERSE_RECORD || true,
  fuses: parseInt(process.env.FUSES || '0'),
  initialRecordFile: process.env.INITIAL_RECORD_FILE
}
