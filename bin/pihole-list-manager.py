import argparse
import re
import sqlite3
from pathlib import Path

PIHOLE_DB = "/etc/pihole/gravity.db"

def get_db_connection():
    db_path = Path(PIHOLE_DB)
    if not db_path.exists():
        raise FileNotFoundError(f"Pi-hole database not found at {PIHOLE_DB}")
    return sqlite3.connect(PIHOLE_DB)

def validate_domain(domain):
    pattern = r"^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$"
    if not re.match(pattern, domain, re.IGNORECASE):
        raise ValueError(f"Invalid domain format: {domain}")
    return domain.lower()

def list_domains(list_type):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, domain, type 
            FROM domainlist 
            WHERE type = ?
            ORDER BY domain
        """, (list_type,))
        
        print(f"\n{'ID':<5} {'Domain':<40} {'Type'}")
        print("-" * 50)
        for row in cursor.fetchall():
            list_name = "Whitelist" if row[2] == 0 else "Blacklist"
            print(f"{row[0]:<5} {row[1]:<40} {list_name}")
        print()

def add_domain(domain, list_type):
    domain = validate_domain(domain)
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Check for existing entry
        cursor.execute("""
            SELECT 1 FROM domainlist 
            WHERE domain = ? AND type = ?
        """, (domain, list_type))
        
        if cursor.fetchone():
            print(f"Domain already in {'whitelist' if list_type == 0 else 'blacklist'}: {domain}")
            return

        # Insert new entry
        cursor.execute("""
            INSERT INTO domainlist (domain, type, enabled, date_added, date_modified, comment)
            VALUES (?, ?, 1, strftime('%s','now'), strftime('%s','now'), 'Added by script')
        """, (domain, list_type))
        conn.commit()
    
    print(f"Added {domain} to {'whitelist' if list_type == 0 else 'blacklist'}")
    restart_dns_service()

def remove_domain(domain, list_type):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            DELETE FROM domainlist
            WHERE domain = ? AND type = ?
        """, (domain, list_type))
        deleted = cursor.rowcount
        conn.commit()
    
    if deleted > 0:
        print(f"Removed {domain} from {'whitelist' if list_type == 0 else 'blacklist'}")
        restart_dns_service()
    else:
        print(f"Domain not found in {'whitelist' if list_type == 0 else 'blacklist'}: {domain}")

def restart_dns_service():
    import subprocess
    subprocess.run(["pihole", "restartdns", "reload"], check=True)

def main():
    parser = argparse.ArgumentParser(description="Manage Pi-hole whitelist/blacklist")
    subparsers = parser.add_subparsers(dest='command', required=True)
    
    # Whitelist commands
    whitelist_parser = subparsers.add_parser('whitelist', help="Manage whitelist")
    wl_subparsers = whitelist_parser.add_subparsers(dest='wl_command', required=True)
    
    wl_list = wl_subparsers.add_parser('list', help='List whitelisted domains')
    wl_list.set_defaults(func=lambda _: list_domains(0))
    
    wl_add = wl_subparsers.add_parser('add', help='Add to whitelist')
    wl_add.add_argument('domain', type=validate_domain, help='Domain to whitelist')
    wl_add.set_defaults(func=lambda args: add_domain(args.domain, 0))
    
    wl_remove = wl_subparsers.add_parser('remove', help='Remove from whitelist')
    wl_remove.add_argument('domain', type=validate_domain, help='Domain to remove')
    wl_remove.set_defaults(func=lambda args: remove_domain(args.domain, 0))
    
    # Blacklist commands
    blacklist_parser = subparsers.add_parser('blacklist', help="Manage blacklist")
    bl_subparsers = blacklist_parser.add_subparsers(dest='bl_command', required=True)
    
    bl_list = bl_subparsers.add_parser('list', help='List blacklisted domains')
    bl_list.set_defaults(func=lambda _: list_domains(1))
    
    bl_add = bl_subparsers.add_parser('add', help='Add to blacklist')
    bl_add.add_argument('domain', type=validate_domain, help='Domain to blacklist')
    bl_add.set_defaults(func=lambda args: add_domain(args.domain, 1))
    
    bl_remove = bl_subparsers.add_parser('remove', help='Remove from blacklist')
    bl_remove.add_argument('domain', type=validate_domain, help='Domain to remove')
    bl_remove.set_defaults(func=lambda args: remove_domain(args.domain, 1))

    args = parser.parse_args()
    try:
        if hasattr(args, 'func'):
            args.func(args)
    except Exception as e:
        print(f"Error: {str(e)}")
        exit(1)

if __name__ == "__main__":
    main()

