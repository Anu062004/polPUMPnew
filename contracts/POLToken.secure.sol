// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/// @title Secure POL Token with 0G Storage Integration
/// @notice ERC20 token with immutable metadata stored on 0G Storage
/// @dev Refactored for security: uses OpenZeppelin, proper access control, events
contract POLToken is ERC20, Ownable, Pausable {
    
    // 0G Storage integration - IMMUTABLE after creation
    bytes32 public immutable metadataRootHash;
    bytes32 public immutable imageRootHash;
    string public description;
    address public immutable creator;
    uint256 public immutable createdAt;
    
    // Events
    event TokenCreated(
        address indexed creator,
        string name,
        string symbol,
        bytes32 metadataRootHash,
        bytes32 imageRootHash,
        uint256 initialSupply,
        uint256 timestamp
    );
    
    event DescriptionUpdated(
        address indexed updater,
        string oldDescription,
        string newDescription,
        uint256 timestamp
    );
    
    /// @notice Constructor - creates token with immutable metadata
    /// @param _name Token name
    /// @param _symbol Token symbol
    /// @param initialSupply Initial token supply (minted to creator)
    /// @param _description Token description
    /// @param _metadataRootHash 0G Storage metadata root hash
    /// @param _imageRootHash 0G Storage image root hash
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 initialSupply,
        string memory _description,
        bytes32 _metadataRootHash,
        bytes32 _imageRootHash
    ) ERC20(_name, _symbol) {
        require(initialSupply > 0, "POLToken: zero supply");
        require(bytes(_name).length > 0, "POLToken: empty name");
        require(bytes(_symbol).length > 0, "POLToken: empty symbol");
        require(_metadataRootHash != bytes32(0), "POLToken: zero metadata hash");
        require(_imageRootHash != bytes32(0), "POLToken: zero image hash");
        
        description = _description;
        metadataRootHash = _metadataRootHash;
        imageRootHash = _imageRootHash;
        creator = msg.sender;
        createdAt = block.timestamp;
        
        _mint(msg.sender, initialSupply);
        
        emit TokenCreated(
            msg.sender,
            _name,
            _symbol,
            _metadataRootHash,
            _imageRootHash,
            initialSupply,
            block.timestamp
        );
    }
    
    /// @notice Update description only (metadata hashes are immutable)
    /// @param _description New description
    /// @dev Only creator can update, and only description (not hashes)
    function updateDescription(string memory _description) external {
        require(msg.sender == creator, "POLToken: not creator");
        require(bytes(_description).length > 0, "POLToken: empty description");
        
        string memory oldDescription = description;
        description = _description;
        
        emit DescriptionUpdated(msg.sender, oldDescription, _description, block.timestamp);
    }
    
    /// @notice Get complete token metadata
    /// @return Token metadata struct
    function getMetadata() external view returns (
        string memory _name,
        string memory _symbol,
        string memory _description,
        bytes32 _metadataRootHash,
        bytes32 _imageRootHash,
        address _creator,
        uint256 _createdAt,
        uint256 _totalSupply
    ) {
        return (
            name(),
            symbol(),
            description,
            metadataRootHash,
            imageRootHash,
            creator,
            createdAt,
            totalSupply()
        );
    }
    
    /// @notice Pause token transfers (emergency only)
    /// @dev Only owner can pause
    function pause() external onlyOwner {
        _pause();
    }
    
    /// @notice Unpause token transfers
    /// @dev Only owner can unpause
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /// @notice Override transfer to add pause functionality
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }
}
