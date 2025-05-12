// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DocumentValidation {
    // Mapping to store submitted document hashes
    mapping(bytes32 => bool) private documents;

    // Event to log document submission
    event DocumentSubmitted(bytes32 indexed documentHash);

    // Function to submit a document
    function submitDocument(bytes32 documentHash) public {
        require(!documents[documentHash], "Document already exists");

        // Store the document hash
        documents[documentHash] = true;

        // Emit the event
        emit DocumentSubmitted(documentHash);
    }
}
