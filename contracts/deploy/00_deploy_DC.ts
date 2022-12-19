import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import config from '../config'
import fs from 'fs/promises'
import { chunk, max } from 'lodash'
import { deflateSync } from 'zlib'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  const maxWrapperExpiry = ethers.BigNumber.from(new Uint8Array(8).fill(255)).toString()
  const initConfiguration = {
    baseRentalPrice: ethers.utils.parseEther(config.baseRentalPrice),
    revenueAccount: config.revenueAccount,
    registrarController: config.registrarController,
    duration: config.duration * 3600 * 24,
    resolver: config.resolver,
    reverseRecord: config.reverseRecord,
    fuses: config.fuses,
    wrapperExpiry: maxWrapperExpiry
  }
  console.log(`DC initial Configuration: ${JSON.stringify(initConfiguration, null, 2)}`)

  const DC = await deploy('DC', {
    from: deployer,
    args: [initConfiguration],
    log: true,
    autoMine: true // speed up deployment on local network (ganache, hardhat), no effect on live networks
  })
  console.log('D1DC address:', DC.address)
  const dc = await ethers.getContractAt('DC', DC.address)
  const readConfiguration = {
    baseRentalPrice: ethers.utils.formatUnits(await dc.baseRentalPrice()),
    revenueAccount: await dc.revenueAccount(),
    registrarController: await dc.registrarController(),
    duration: (await dc.duration()).toString(),
    resolver: await dc.resolver(),
    reverseRecord: await dc.reverseRecord(),
    fuses: await dc.fuses(),
    wrapperExpiry: (await dc.wrapperExpiry()).toString()
    // getPrice: (await dc.getPrice('test'))
  }
  console.log(`DC Read Configuration: ${JSON.stringify(readConfiguration, null, 2)}`)
}
export default func
func.tags = ['DC']
