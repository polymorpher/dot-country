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
    duration: config.duration * 3600 * 24,
    gracePeriod: config.gracePeriod * 3600 * 24,

    revenueAccount: config.revenueAccount,
    dc: config.dc
  }
  console.log(`Tweet initial Configuration: ${JSON.stringify(initConfiguration, null, 2)}`)

  const Tweet = await deploy('Tweet', {
    from: deployer,
    args: [initConfiguration],
    log: true,
    autoMine: true // speed up deployment on local network (ganache, hardhat), no effect on live networks
  })
  console.log('Tweet address:', Tweet.address)
  const tweet = await ethers.getContractAt('Tweet', Tweet.address) as Tweet
  if (config.initialRecordFile) {
    const records:{name:string, key: string, record: Tweet.NameRecordStruct}[] = JSON.parse(await fs.readFile(config.initialRecordFile, { encoding: 'utf-8' }))
    const chunks = chunk(records, 50)
    await tweet.initialize([ethers.utils.id('')], [{ renter: ethers.constants.AddressZero, lastPrice: '0', rentTime: '0', expirationTime: '0', url: '', prev: '', next: chunks[0][0].name }])
    for (const c of chunks) {
      const names = c.map(e => e.name)
      const records = c.map(e => {
        const { renter, rentTime, expirationTime, lastPrice, url } = e.record
        return { renter, rentTime, expirationTime, lastPrice, url, prev: '', next: '' }
      })
      console.log(`initializing ${names.length} records, starting from ${names[0]}: ${JSON.stringify(records[0])}`)
      await tweet.initialize(names, records)
    }
  }
  await tweet.finishInitialization()
  const n = (await tweet.numRecords()).toNumber()
  console.log(`Tweet finished initialization for ${n} records`)

  const readConfiguration = {
    baseRentalPrice: ethers.utils.formatUnits(await tweet.baseRentalPrice()),
    duration: (await tweet.duration()).toString(),
    gracePeriod: (await tweet.gracePeriod()).toString(),

    revenueAccount: await tweet.revenueAccount(),
    initialized: await tweet.initialized()
  }
  console.log(`Tweet Read Configuration: ${JSON.stringify(readConfiguration, null, 2)}`)

  const getRecords = async (keys:string[]) => {
    const recordsRaw = await Promise.all(keys.map(k => tweet.nameRecords(k)))
    return recordsRaw.map(({
      renter,
      rentTime,
      expirationTime,
      lastPrice,
      url,
      prev,
      next
    }) => {
      return {
        renter,
        rentTime: new Date(parseInt(rentTime.toString()) * 1000).toLocaleString(),
        expirationTime: new Date(parseInt(expirationTime.toString()) * 1000).toLocaleString(),
        lastPrice: ethers.utils.formatEther(lastPrice),
        url,
        prev,
        next
      }
    })
  }

  console.log(`key ${ethers.utils.id('')}, record:`, await getRecords([ethers.utils.id('')]))

  for (let i = 0; i < n; i += 50) {
    const keys = await tweet.getRecordKeys(i, Math.min(n, i + 50))
    const records = await getRecords(keys)
    console.log(`Records ${i} to ${Math.min(n, i + 50)}: `, keys, records)
  }
}
export default func
func.tags = ['Tweet']
func.dependencies = ['DC']
