// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

contract PasswordMatcher {

    uint256 public count = 0; // State variable to track the number of password checks

    // Event to log password match attempts
    event PasswordMatchAttempt(uint256 indexed attemptNumber, bool isMatch);

    // Function to compare two password strings
    function matchPasswords(string memory password1, string memory password2) public returns (bool) {
        count = count + 1; // Increment the count

        // Compare the two strings
        bool isMatch = keccak256(abi.encodePacked(password1)) == keccak256(abi.encodePacked(password2));

        // Emit an event with the match result
        emit PasswordMatchAttempt(count, isMatch);

        return isMatch;
    }
}
