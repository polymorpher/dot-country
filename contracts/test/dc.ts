// import { expect } from "chai";
import { ethers } from 'hardhat'
import config from '../config'

// const name = '.country'
// const symbol = 'DC'
// const baseRentalPrice = 100
// const rentalPeriod = 365
// const priceMultiplier = 2
// const revenueAccount = config.revenueAccount
// const registrarController = config.registrarController

const maxWrapperExpiry = ethers.BigNumber.from(new Uint8Array(8).fill(255)).toString()
const initConfiguration = {
  wrapperExpiry: maxWrapperExpiry,
  fuses: config.fuses,
  registrarController: config.registrarController,
  nameWrapper: config.nameWrapper,
  baseRegistrar: config.registrar,
  resolver: config.resolver,
  reverseRecord: config.reverseRecord

}
console.log(`initConfiguration: ${JSON.stringify(initConfiguration)}`)

describe('DC', function () {
  it('Should be deployed', async function () {
    const DC = await ethers.getContractFactory('DC')
    const dc = await DC.deploy(initConfiguration)
    await dc.deployed()
    console.log(`DC.address: ${dc.address}`)
  })
})
