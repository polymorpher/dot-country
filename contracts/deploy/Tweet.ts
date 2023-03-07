import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'
import config from '../config'
import fs from 'fs/promises'
import { chunk } from 'lodash'
import { Tweet } from '../typechain-types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  const initConfiguration = {
    baseRentalPrice: ethers.utils.parseEther(config.baseRentalPrice).toString(),
    revenueAccount: config.revenueAccount,
    dc: config.dc
  }
  console.log('Tweet initial config', initConfiguration)

  const Tweet = await deploy('Tweet', {
    from: deployer,
    args: [initConfiguration],
    log: true,
    autoMine: true
  })
  console.log('Tweet address:', Tweet.address)
  const tweet = await ethers.getContractAt('Tweet', Tweet.address) as Tweet
  if (config.initialRecordFile) {
    const records: {key:string, urls: string[]}[] = JSON.parse(await fs.readFile(config.initialRecordFile, { encoding: 'utf-8' }))
    const chunks = chunk(records, 50)
    for (const c of chunks) {
      const keys = c.map(e => e.key)
      await tweet.initializeActivation(keys)
      console.log(`initialized activation for ${keys.length} records`)
    }
    for (const r of records) {
      await tweet.initializeUrls(r.key, r.urls)
      console.log(`initialized urls for key ${r.key}, urls: ${JSON.stringify(r.urls)}`)
    }
  }
  await tweet.finishInitialization()
  console.log('Tweet finished initialization')

  const readConfiguration = {
    baseRentalPrice: ethers.utils.formatUnits(await tweet.baseRentalPrice()),
    revenueAccount: await tweet.revenueAccount(),
    dc: await tweet.dc(),
    initialized: await tweet.initialized()
  }
  console.log(`Tweet config on contract:\n${JSON.stringify(readConfiguration, null, 2)}`)
}
export default func
func.tags = ['Tweet']
