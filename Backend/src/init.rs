use crate::auth::hash_password;
use crate::database::Database;

pub fn init_default_user(db: &Database) {
    let username = "admin";
    let password = "admin";

    // Hash sécurisé Argon2 (avec salt)
    let password_hash = hash_password(password);

    match db.create_user(username, &password_hash) {
        Ok(_) => {
            println!("Utilisateur par défaut créé: {}:{}", username, password);
        }
        Err(_) => {
            println!(
                "Utilisateur '{}' existe déjà ou erreur lors de la création",
                username
            );
        }
    }
}