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
    duration: config.duration * 3600 * 24,

    revenueAccount: config.revenueAccount,
    wrapperExpiry: maxWrapperExpiry,
    fuses: config.fuses,

    registrarController: config.registrarController,
    baseRegistrar: config.registrar,
    resolver: config.resolver,
    reverseRecord: config.reverseRecord
  }
  console.log(`DC initial Configuration: ${JSON.stringify(initConfiguration, null, 2)}`)

  const DC = await deploy('DC', {
    from: deployer,
    args: [initConfiguration],
    log: true,
    autoMine: true // speed up deployment on local network (ganache, hardhat), no effect on live networks
  })

  console.log('DC address:', DC.address)
  const dc = await ethers.getContractAt('DC', DC.address)
  const readConfiguration = {
    baseRentalPrice: ethers.utils.formatUnits(await dc.baseRentalPrice()),
    duration: (await dc.duration()).toString(),

    revenueAccount: await dc.revenueAccount(),
    wrapperExpiry: (await dc.wrapperExpiry()).toString(),
    fuses: await dc.fuses(),

    registrarController: await dc.registrarController(),
    baseRegistrar: await dc.baseRegistrar(),
    resolver: await dc.resolver(),
    reverseRecord: await dc.reverseRecord()
  }
  console.log(`DC Read Configuration: ${JSON.stringify(readConfiguration, null, 2)}`)
}
export default func
func.tags = ['DC']
