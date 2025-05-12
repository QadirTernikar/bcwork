const PasswordMatcher = artifacts.require("PasswordMatcher");
const DocumentVerification = artifacts.require("DocumentVerification");

module.exports = async function (deployer) {
  // Deploy PasswordMatcher contract
  await deployer.deploy(PasswordMatcher);

  // Deploy DocumentVerification contract
  await deployer.deploy(DocumentVerification);
};
