import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import config from '../config'
import { DC, DCDeployer, Tweet } from '../typechain-types'
import assert from 'assert'

const keypress = async () => {
  return new Promise(resolve => process.stdin.once('data', () => {
    resolve(null)
  }))
}

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre
  assert(ethers.utils.isAddress(config.revenueAccount), 'Invalid Revenue Account')
  assert(ethers.utils.isAddress(config.multisig), 'Invalid Multisig Account')
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const initConfiguration:DC.InitConfigurationStruct = {
    wrapperExpiry: ethers.BigNumber.from(new Uint8Array(8).fill(255)).toString() as string,
    fuses: config.fuses,
    registrarController: config.registrarController,
    nameWrapper: config.nameWrapper,
    baseRegistrar: config.registrar,
    resolver: config.resolver,
    reverseRecord: config.reverseRecord,
    duration: config.duration * 3600 * 24
  }
  const tweetInitConfiguration = {
    baseRentalPrice: ethers.utils.parseEther(config.baseRentalPrice).toString(),
    revenueAccount: config.revenueAccount
  }

  console.log('DC initial config', initConfiguration)
  console.log('Tweet initial config', tweetInitConfiguration)

  const DCDeployer = await deploy('DCDeployer', {
    from: deployer,
    args: [config.multisig],
    log: true
  })

  const dcDeployer = await ethers.getContractAt('DCDeployer', DCDeployer.address) as DCDeployer
  const deployCalldata = dcDeployer.interface.encodeFunctionData('deploy', [
    initConfiguration,
    ethers.utils.parseEther(config.baseRentalPrice).toString(),
    config.revenueAccount
  ])
  const transferOwnerCalldata = dcDeployer.interface.encodeFunctionData('transferOwner', [config.multisig])

  console.log('DCDeployer address:', DCDeployer.address)
  console.log(`Calldata for deploy: ${deployCalldata}`)
  console.log(`Calldata for transferOwner: ${transferOwnerCalldata}`)
  console.log('Press any key to continue after you complete deploying on multisig')
  await keypress()

  const dcAddress = await dcDeployer.dc()
  const tweetAddress = await dcDeployer.tt()
  const lazyBundlerAddress = await dcDeployer.lb()

  const dc = await ethers.getContractAt('DC', dcAddress) as DC
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

  const tweet = await ethers.getContractAt('Tweet', tweetAddress) as Tweet
  const tweetReadConfiguration = {
    baseRentalPrice: ethers.utils.formatUnits(await tweet.baseRentalPrice()),
    revenueAccount: await tweet.revenueAccount(),
    dc: await tweet.dc(),
    initialized: await tweet.initialized()
  }
  console.log(`Tweet config on contract:\n${JSON.stringify(tweetReadConfiguration, null, 2)}`)
  console.log({
    dcDeployerAddress: dcDeployer.address,
    dcAddress,
    tweetAddress,
    lazyBundlerAddress
  })
}
export default func
func.tags = ['DCDeployer']
