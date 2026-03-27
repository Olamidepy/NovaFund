#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

fn create_test_wallet() -> (Env, Address, Address) {
    let env = Env::default();
    let owner = Address::generate(&env);
    
    let contract_id = env.register_contract(None, SmartWallet);
    
    // Create guardians
    let guardian1 = Address::generate(&env);
    let guardian2 = Address::generate(&env);
    let guardian3 = Address::generate(&env);
    
    let mut guardians = Vec::new(&env);
    guardians.push_back(guardian1);
    guardians.push_back(guardian2);
    guardians.push_back(guardian3);
    
    let client = SmartWalletClient::new(&env, &contract_id);
    env.mock_all_auths();
    client.initialize(&owner, &guardians, &3u32);
    
    (env, owner, contract_id)
}

#[test]
fn test_initialize_succeeds() {
    let env = Env::default();
    let owner = Address::generate(&env);
    
    let guardian1 = Address::generate(&env);
    let guardian2 = Address::generate(&env);
    let guardian3 = Address::generate(&env);
    
    let mut guardians = Vec::new(&env);
    guardians.push_back(guardian1);
    guardians.push_back(guardian2);
    guardians.push_back(guardian3);
    
    let contract_id = env.register_contract(None, SmartWallet);
    let client = SmartWalletClient::new(&env, &contract_id);
    
    env.mock_all_auths();
    client.initialize(&owner, &guardians, &3u32);
    
    let stored_owner = client.get_owner();
    assert!(stored_owner.is_some());
    assert_eq!(stored_owner.unwrap(), owner);
}

#[test]
fn test_initialize_with_less_than_3_guardians_fails() {
    let env = Env::default();
    let owner = Address::generate(&env);
    
    let guardian1 = Address::generate(&env);
    let guardian2 = Address::generate(&env);
    
    let mut guardians = Vec::new(&env);
    guardians.push_back(guardian1);
    guardians.push_back(guardian2);
    
    let contract_id = env.register_contract(None, SmartWallet);
    let client = SmartWalletClient::new(&env, &contract_id);
    
    env.mock_all_auths();
    let result = client.try_initialize(&owner, &guardians, &2u32);
    assert!(result.is_err());
}

#[test]
fn test_add_guardian_succeeds() {
    let (env, owner, contract_id) = create_test_wallet();
    let client = SmartWalletClient::new(&env, &contract_id);
    
    let new_guardian = Address::generate(&env);
    
    env.mock_all_auths();
    client.add_guardian(&owner, &new_guardian);
    
    let guardians = client.get_guardians();
    assert_eq!(guardians.len(), 4);
}

#[test]
fn test_remove_guardian_succeeds() {
    let (env, owner, contract_id) = create_test_wallet();
    let client = SmartWalletClient::new(&env, &contract_id);
    
    let guardians = client.get_guardians();
    let guardian_to_remove = guardians.get(0).unwrap().address;
    
    env.mock_all_auths();
    client.remove_guardian(&owner, &guardian_to_remove);
    
    let guardians_after = client.get_guardians();
    assert_eq!(guardians_after.len(), 3);
}

#[test]
fn test_remove_guardian_below_minimum_fails() {
    let (env, owner, contract_id) = create_test_wallet();
    let client = SmartWalletClient::new(&env, &contract_id);
    
    // Try to remove when we only have 3 guardians
    let guardians = client.get_guardians();
    let guardian_to_remove = guardians.get(0).unwrap().address;
    
    env.mock_all_auths();
    let result = client.try_remove_guardian(&owner, &guardian_to_remove);
    assert!(result.is_err());
}

#[test]
fn test_initiate_recovery_by_guardian_succeeds() {
    let (env, _owner, contract_id) = create_test_wallet();
    let client = SmartWalletClient::new(&env, &contract_id);
    
    let new_owner = Address::generate(&env);
    
    // Guardian initiates recovery
    env.mock_all_auths();
    client.initiate_recovery(&new_owner);
    
    let request = client.get_recovery_request();
    assert!(request.is_some());
    assert_eq!(request.unwrap().new_owner, new_owner);
}

#[test]
fn test_approve_recovery_succeeds() {
    let (env, _owner, contract_id) = create_test_wallet();
    let client = SmartWalletClient::new(&env, &contract_id);
    
    let new_owner = Address::generate(&env);
    
    // First guardian initiates
    env.mock_all_auths();
    client.initiate_recovery(&new_owner);
    
    // Second guardian approves
    client.approve_recovery();
    
    let request = client.get_recovery_request();
    assert!(request.is_some());
    assert_eq!(request.unwrap().approvals.len(), 2);
}

#[test]
fn test_execute_recovery_requires_threshold() {
    let (env, _owner, contract_id) = create_test_wallet();
    let client = SmartWalletClient::new(&env, &contract_id);
    
    let new_owner = Address::generate(&env);
    
    // Initiate recovery
    env.mock_all_auths();
    client.initiate_recovery(&new_owner);
    
    // Get threshold
    let threshold = client.get_threshold().unwrap();
    
    // Need threshold approvals
    // With 3 guardians and threshold 3, need all 3
    // Already have 1 from initiation, need 2 more
    client.approve_recovery(); // 2nd approval
    
    // Still need 3rd approval for threshold=3
    // But execute should fail before time lock passes
    let result = client.try_execute_recovery();
    assert!(result.is_err()); // Fails due to time lock
}

#[test]
fn test_cancel_recovery_by_owner_succeeds() {
    let (env, _owner, contract_id) = create_test_wallet();
    let client = SmartWalletClient::new(&env, &contract_id);
    
    let new_owner = Address::generate(&env);
    
    // Guardian initiates
    env.mock_all_auths();
    client.initiate_recovery(&new_owner);
    
    // Owner cancels
    let owner = client.get_owner().unwrap();
    client.cancel_recovery(&owner);
    
    let request = client.get_recovery_request();
    assert!(request.is_none());
}

#[test]
fn test_get_guardians_returns_all() {
    let (env, _owner, contract_id) = create_test_wallet();
    let client = SmartWalletClient::new(&env, &contract_id);
    
    let guardians = client.get_guardians();
    assert_eq!(guardians.len(), 3);
}

#[test]
fn test_receive_succeeds() {
    let (env, _owner, contract_id) = create_test_wallet();
    let client = SmartWalletClient::new(&env, &contract_id);
    
    let result = client.try_receive();
    assert!(result.is_ok());
}

#[test]
fn test_double_approval_fails() {
    let (env, _owner, contract_id) = create_test_wallet();
    let client = SmartWalletClient::new(&env, &contract_id);
    
    let new_owner = Address::generate(&env);
    
    // Guardian initiates (automatically approves)
    env.mock_all_auths();
    client.initiate_recovery(&new_owner);
    
    // Same guardian tries to approve again
    let result = client.try_approve_recovery();
    assert!(result.is_err()); // Already approved
}
