export async function deploy(deployer) {
    await deployer.deploy({
        contract: "Counter",
    });
}
