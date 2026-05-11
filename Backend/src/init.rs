use crate::auth::hash_password;
use crate::database::Database;

pub fn init_default_user(db: &Database) {
    // Créer un utilisateur par défaut : admin/admin
    let username = "admin";
    let password = "admin";
    let password_hash = hash_password(password);

    match db.create_user(username, &password_hash) {
        Ok(_) => println!("Utilisateur par défaut créé: {}:{}", username, password),
        Err(_) => {
            // L'utilisateur existe probablement déjà, c'est normal
            println!("Utilisateur '{}' existe déjà ou erreur lors de la création", username);
        }
    }
}
