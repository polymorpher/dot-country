import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployFunction } from 'hardhat-deploy/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()
  const LazyBundler = await deploy('LazyBundler', {
    from: deployer,
    args: [],
    log: true,
    autoMine: true
  })
  console.log('LazyBundler address:', LazyBundler.address)
}
export default func
func.tags = ['LazyBundler']
