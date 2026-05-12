use crate::database::Database;

pub fn init_default_user(db: &Database) {
    let username = "admin";
    let password = "admin";

    match db.create_user(username, password) {
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