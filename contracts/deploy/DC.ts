import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import config from '../config'
import { DC } from '../typechain-types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const initConfiguration = {
    wrapperExpiry: ethers.BigNumber.from(new Uint8Array(8).fill(255)).toString(),
    fuses: config.fuses,
    registrarController: config.registrarController,
    nameWrapper: config.nameWrapper,
    baseRegistrar: config.registrar,
    resolver: config.resolver,
    reverseRecord: config.reverseRecord,
    duration: config.duration * 3600 * 24
  }
  console.log('DC initial config', initConfiguration)

  const DC = await deploy('DC', {
    from: deployer,
    args: [initConfiguration],
    log: true,
    autoMine: true
  })
  console.log('DC address:', DC.address)
  const dc = await ethers.getContractAt('DC', DC.address) as DC
  const readConfiguration = {
    wrapperExpiry: (await dc.wrapperExpiry()).toString(),
    fuses: await dc.fuses(),
    registrarController: await dc.registrarController(),
    baseRegistrar: await dc.baseRegistrar(),
    resolver: await dc.resolver(),
    reverseRecord: await dc.reverseRecord(),
    duration: (await dc.duration()).toNumber()
  }
  console.log(`DC Read Configuration:\n${JSON.stringify(readConfiguration, null, 2)}`)
}
export default func
func.tags = ['DC']
