# DNS Lists VLAN Support

This update adds VLAN-specific DNS whitelist, blacklist, and block lists functionality to the system.

## Changes Made

1. Updated the CustomDNSLists component to include a VLAN selector dropdown
2. Modified the DNS lists API to support VLAN-specific filtering
3. Created a SQL script to update the database schema
4. Added Block Lists feature for managing external blocklist URLs
5. Added Apply Changes button to verify and apply blocklists

## Database Schema Changes

The following changes need to be made to the database:

1. Add a `vlan_id` column (integer) to both the `whitelist` and `blacklist` tables
2. Set default values for existing entries (VLAN ID 0 for default)
3. Create composite unique indexes to prevent duplicate domains within the same VLAN
4. Create a new `blocklists` table for storing block list entries

## Implementation Details

- VLAN ID 0 is used for the default/system-wide DNS entries
- Other VLAN IDs correspond to the IDs in the vlans.json configuration file
- The frontend displays "Default" for VLAN ID 0 and the VLAN names for other IDs
- Block lists are stored both in the database and in JSON files at:
  - Default VLAN: `/etc/darkflows/unbound/default/blocklists.json`
  - Other VLANs: `/etc/darkflows/unbound/{vlan_id}/blocklists.json`
- Block list names must contain only letters and numbers (no spaces or special characters)
- The Apply Changes button calls the `/usr/local/darkflows/bin/verify_blocklists.py` script to verify and apply blocklists

## How to Apply the Changes

1. Run the SQL scripts on the server:

```bash
mysql -u root unbound < update_dns_tables.sql
mysql -u root unbound < update_blocklists_table.sql
```

2. Create the necessary directories:

```bash
mkdir -p /etc/darkflows/unbound/default
```

3. Copy the sample blocklists.json file:

```bash
cp sample_blocklists.json /etc/darkflows/unbound/default/blocklists.json
```

4. Restart the application to apply the changes:

```bash
systemctl restart darkflows
```

## Usage

- The DNS Custom Blocklists component now has a dropdown in the top-right corner
- Select "Default" for system-wide DNS entries or select a specific VLAN
- When adding new domains or block lists, they will be associated with the currently selected VLAN
- Each VLAN can have its own set of whitelisted domains, blacklisted domains, and block lists
- Block lists require both a name and a URL to an external hosts file
- Block list names must contain only letters and numbers (no spaces or special characters)
- Click the Apply Changes button (sync icon) to verify and apply the blocklists
- Successfully updated blocklists will be highlighted with a green border and "Updated successfully" message 