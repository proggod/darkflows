-- Add vlan_id column to whitelist table if it doesn't exist
ALTER TABLE whitelist ADD COLUMN IF NOT EXISTS vlan_id INT NOT NULL DEFAULT 0;

-- Add vlan_id column to blacklist table if it doesn't exist
ALTER TABLE blacklist ADD COLUMN IF NOT EXISTS vlan_id INT NOT NULL DEFAULT 0;

-- Update existing entries to have the default vlan_id
UPDATE whitelist SET vlan_id = 0 WHERE vlan_id IS NULL;
UPDATE blacklist SET vlan_id = 0 WHERE vlan_id IS NULL;

-- Create a composite unique index to prevent duplicate domains within the same VLAN
ALTER TABLE whitelist DROP INDEX IF EXISTS idx_domain_vlan;
ALTER TABLE blacklist DROP INDEX IF EXISTS idx_domain_vlan;

ALTER TABLE whitelist ADD UNIQUE INDEX idx_domain_vlan (domain, vlan_id);
ALTER TABLE blacklist ADD UNIQUE INDEX idx_domain_vlan (domain, vlan_id); 