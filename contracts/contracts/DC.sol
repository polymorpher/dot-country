// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import {IETHRegistrarController, IPriceOracle} from "@ensdomains/ens-contracts/contracts/ethregistrar/IETHRegistrarController.sol";

/**
    @title A domain manager contract for .country (DC -  Dot Country)
    @author John Whitton (github.com/johnwhitton), reviewed and revised by Aaron Li (github.com/polymorpher)
    @notice This contract allows the rental of domains under .country (”DC”)
    it integrates with the ENSRegistrarController and the ENS system as a whole for persisting of domain registrations.
    It is responsible for holding the revenue from these registrations for the web2 portion of the registration process,
    with the web3 regisgtration revenue being held by the RegistrarController contract.
    An example would be as follows Alice registers alice.com and calls the register function with an amount of 10,000 ONE.
    5000 ONE would be held by the DC contract and the remaining 5000 funds would be sent to the RegistrarController using 
    the register function.

 */
contract DC is Pausable, Ownable {
    uint256 constant MIN_DURATION = 365 days;
    bytes constant EMPTY_DATA = new bytes(0);
    bool public initialized;
    uint256 public baseRentalPrice;
    address public revenueAccount;
    address public registrarController;
    uint256 public duration;
    address public resolver;
    bool public reverseRecord;
    uint32 public fuses;
    uint64 public wrapperExpiry;

    IETHRegistrarController RegistrarControllerContract =
        IETHRegistrarController(registrarController);
    IPriceOracle PriceOracleContract = IPriceOracle(registrarController);

    // Use a structure for Initial Configuration to fix stack too deep error
    struct InitConfiguration {
        uint256 baseRentalPrice;
        address revenueAccount;
        address registrarController;
        uint256 duration;
        address resolver;
        bool reverseRecord;
        uint32 fuses;
        uint64 wrapperExpiry;
    }

    //TODO events
    //TODO madeCommitment
    //TODO committed
    event NameRegistered(
        string name,
        bytes32 indexed label,
        address indexed owner,
        uint256 baseCost,
        uint256 premium,
        uint256 expires
    );
    event NameRenewed(
        string name,
        bytes32 indexed label,
        uint256 cost,
        uint256 expires
    );

    event NameRented(
        string indexed name,
        address indexed renter,
        uint256 price,
        string url
    );

    event RevenueAccountChanged(address from, address to);

    /**
     * @dev Emitted if setting the duration e.g. if the owner tried to se the duration less than the Minimum duration of 365 days
     * @param duration The duration of the rental period
     * @param reason The reason for the error
     */
    error setDurationFailed(uint256 duration, string reason);

    constructor(InitConfiguration memory _initConfig) {
        setBaseRentalPrice(_initConfig.baseRentalPrice);
        setRevenueAccount(_initConfig.revenueAccount);
        setRevenueAccount(_initConfig.revenueAccount);
        setRegistrarController(_initConfig.registrarController);
        setDuration(_initConfig.duration);
        setResolver(_initConfig.resolver);
        setReverseRecord(_initConfig.reverseRecord);
        setFuses(_initConfig.fuses);
        setWrapperExpiry(_initConfig.wrapperExpiry);
    }

    // admin functions
    function setBaseRentalPrice(uint256 _baseRentalPrice) public onlyOwner {
        baseRentalPrice = _baseRentalPrice;
    }

    function setRevenueAccount(address _revenueAccount) public onlyOwner {
        emit RevenueAccountChanged(revenueAccount, _revenueAccount);
        revenueAccount = _revenueAccount;
    }

    function setRegistrarController(address _registrarController)
        public
        onlyOwner
    {
        registrarController = _registrarController;
    }

    function setDuration(uint256 _duration) public onlyOwner {
        if (_duration < MIN_DURATION) {
            revert setDurationFailed(
                _duration,
                "Duration less than the minimum of 365 days"
            );
        }
        duration = _duration;
    }

    function setResolver(address _resolver) public onlyOwner {
        resolver = _resolver;
    }

    function setReverseRecord(bool _reverseRecord) public onlyOwner {
        reverseRecord = _reverseRecord;
    }

    function setFuses(uint32 _fuses) public onlyOwner {
        fuses = _fuses;
    }

    function setWrapperExpiry(uint64 _wrapperExpiry) public onlyOwner {
        wrapperExpiry = _wrapperExpiry;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    //TODO Admin Functions
    // TODO change Owner
    // TODO add operator
    // TODO remove operator

    // TODO Operator functions
    // TODO RegisterFree
    // TODO RenewFree

    // TODO User functions
    /**
     * @dev `available` calls RegistrarController to check if a name is available
     * @param name The name to be checked being registered
     */
    function available(string memory name) public returns (bool) {
        return RegistrarControllerContract.available(name);
    }

    /**
     * @dev `makeCommitment` calls RegistrarController makeCommitment with prepopulated values
     * commitment is just a keccak256 hash
     * @param name The name being registered
     * @param owner The address of the owner of the name being registered
     * @param secret A secret passed by the client e.g. const [secret] = useState(Math.random().toString(26).slice(2))
     */
    function makeCommitment(
        string memory name,
        address owner,
        bytes32 secret
    ) public view returns (bytes32) {
        bytes32 label = keccak256(bytes(name));
        return
            keccak256(
                abi.encode(
                    label,
                    owner,
                    duration,
                    resolver,
                    EMPTY_DATA,
                    secret,
                    reverseRecord,
                    fuses,
                    wrapperExpiry
                )
            );
    }

    /**
     * @dev `commitment` calls RegistrarController commitment and is used as a locker to ensure that only one registration for a name occurs
     * @param commitment The commitment calculated by makeCommitment
     */
    function commit(bytes32 commitment) public {
        RegistrarControllerContract.commit(commitment);
    }

    /**
     * @dev `getENSPrice` gets the price needed to be paid to ENS which calculated as
     * tRegistrarController.rentPrice (price.base + price.premium)
     * @param name The name being registered
     */
    function getENSPrice(string memory name) public returns (uint256) {
        IPriceOracle.Price memory price = RegistrarControllerContract.rentPrice(
            name,
            duration
        );
        return (price.base + price.premium);
    }

    // /**
    //  * @dev `getCombinedPrice` gets the price needed to be paid which calculated as
    //  * the baseRentalPrice + RegistrarController.rentPrice (price.base + price.premium)
    //  * @param name The name being registered
    //  */
    // function getCombinedPrice(string memory name)
    //     public
    //     returns (uint256, uint256)
    // {
    //     IPriceOracle.Price memory price = RegistrarControllerContract.rentPrice(
    //         name,
    //         duration
    //     );
    //     return (baseRentalPrice, (price.base + price.premium));
    // }

    /**
     * @dev `register` calls RegistrarController register and is used to register a name
     * this also takes a fee for the web2 registration which is held by DC.sol a check is made to ensure the value sent is sufficient for both fees
     * @param name The name to be registered e.g. for test.country it would be test
     * @param owner The owner address of the name to be registered
     * @param secret A secret passed by the client e.g. const [secret] = useState(Math.random().toString(26).slice(2))
     * @param data TODO remove this and default to an empty array
     */
    function register(
        string calldata name,
        address owner,
        bytes32 secret,
        bytes[] calldata data
    ) public payable whenNotPaused {
        require(bytes(name).length <= 128, "DC: name too long");
        uint256 ensPrice = getENSPrice(name);
        require(
            (baseRentalPrice + ensPrice) <= msg.value,
            "DC: insufficient payment"
        );
        _register(name, owner, secret, ensPrice, data);
        uint256 excess = msg.value - (baseRentalPrice + ensPrice);
        if (excess > 0) {
            (bool success, ) = msg.sender.call{value: excess}("");
            require(success, "cannot refund excess");
        }

        // emit NameRegistered(name, msg.sender, price, url);
    }

    /**
     * @dev `_register` calls RegistrarController register and is used to register a name
     * it is passed a value to cover the costs of the ens registration
     * @param name The name to be registered e.g. for test.country it would be test
     * @param owner The owner address of the name to be registered
     * @param secret A secret passed by the client e.g. const [secret] = useState(Math.random().toString(26).slice(2))
     * @param ensPrice the price paid to ens for the registration
     * @param data TODO remove this and default to an empty array
     */
    function _register(
        string calldata name,
        address owner,
        bytes32 secret,
        uint256 ensPrice,
        bytes[] calldata data
    ) internal whenNotPaused {
        RegistrarControllerContract.register{value: ensPrice}(
            name,
            owner,
            duration,
            secret,
            resolver,
            data,
            reverseRecord,
            fuses,
            wrapperExpiry
        );
    }

    /**
     * @dev `renew` calls RegistrarController renew and is used to renew a name
     * this also takes a fee for the web2 renewal which is held by DC.sol a check is made to ensure the value sent is sufficient for both fees
     * duration is set at the contract level
     * @param name The name to be registered e.g. for test.country it would be test
     */
    function renew(string calldata name) public payable whenNotPaused {
        require(bytes(name).length <= 128, "DC: name too long");
        uint256 ensPrice = getENSPrice(name);
        require(
            (baseRentalPrice + ensPrice) <= msg.value,
            "DC: insufficient payment"
        );
        _renew(name, ensPrice);
        uint256 excess = msg.value - (baseRentalPrice + ensPrice);
        if (excess > 0) {
            (bool success, ) = msg.sender.call{value: excess}("");
            require(success, "cannot refund excess");
        }

        // emit NameRegistered(name, msg.sender, price, url);
    }

    /**
     * @dev `_renew` calls RegistrarController renw and is used to renew a name
     * it is passed a value to cover the costs of the ens renewal
     * duration is set at the contract level
     * @param name The name to be registered e.g. for test.country it would be test
     * @param ensPrice the price paid to ens for the registration
     */
    function _renew(string calldata name, uint256 ensPrice)
        internal
        whenNotPaused
    {
        RegistrarControllerContract.renew{value: ensPrice}(name, duration);
    }

    function withdraw() external {
        require(
            msg.sender == owner() || msg.sender == revenueAccount,
            "DC: must be owner or revenue account"
        );
        (bool success, ) = revenueAccount.call{value: address(this).balance}(
            ""
        );
        require(success, "DC: failed to withdraw");
    }
}
