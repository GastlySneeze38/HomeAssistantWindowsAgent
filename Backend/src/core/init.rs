use crate::core::database::Database;

pub fn init_default_user(db: &Database) {
    // Crée admin/admin uniquement si aucun utilisateur n'existe encore
    if db.has_any_users().unwrap_or(false) {
        return;
    }

    match db.create_user("admin", "admin") {
        Ok(_) => println!("Aucun utilisateur trouvé — compte admin/admin créé par défaut."),
        Err(e) => println!("Erreur création admin: {e}"),
    }
}
