import * as dotenv from 'dotenv'
const debug = (process.env.DEBUG === '1') || process.env.DEBUG === 'true'
dotenv.config()

export default {
  debug,
  baseRentalPrice: process.env.BASE_RENTAL_PRICE_ETH || '1',
  rentalPeriod: parseFloat(process.env.RENTAL_PERIOD_DAYS || '1'),
  priceMultiplier: parseInt(process.env.PRICE_MULTIPLIER || '2'),
  revenueAccount: process.env.REVENUE_ACCOUNT,
  registrarController: process.env.REGISTRAR_CONTROLLER || '0x12653A08808F651D5BB78514F377d3BD5E17934C',
  initialRecordFile: process.env.INITIAL_RECORD_FILE
}
