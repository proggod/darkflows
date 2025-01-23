import mysql from 'mysql2/promise';

export async function getMacVendor(macAddress: string): Promise<string> {
  let connection;
  try {
    connection = await mysql.createConnection({
      socketPath: process.env.DATABASE_SOCKET,
      user: 'root',
      database: 'darkflows'
    });

    // Get first 6 characters without colons
    const macPrefix = macAddress.toLowerCase().replace(/:/g, '').slice(0, 6);

    // Debug log
  //  console.log('Looking up MAC vendor:', {
  //    macAddress,
  //    prefix: macPrefix,
  //    originalPrefix: macAddress.slice(0, 8)
  //  });

    const [rows] = await connection.execute<mysql.RowDataPacket[]>(
      'SELECT vendor FROM mac_vendor_lookup WHERE mac_prefix = ?',
      [macPrefix]
    );

    const vendor = (rows as { vendor: string }[])[0]?.vendor || 'Unknown';

    // Debug log
    //console.log('Vendor lookup result:', {
    //  macAddress,
    //  prefix: macPrefix,
    //  vendor,
    //  rowCount: rows.length
    //});

    return vendor;
  } catch (error) {
    console.error('Error looking up MAC vendor:', {
      macAddress,
      error: error instanceof Error ? error.message : error
    });
    return 'Unknown';
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}