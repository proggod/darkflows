import json
import re
from typing import Dict

def parse_bandwidth(data: str) -> Dict[str, Dict[str, str]]:
    hosts = {}
    lines = data.strip().split('\n')
    
    i = 0
    while i < len(lines):
        line = lines[i]
        if any(char * 3 in line for char in ['=', '-']) or 'Host name' in line or 'Total' in line or 'Peak' in line or 'Cumulative' in line:
            i += 1
            continue
            
        external_match = re.search(r'\*\s*=>\s*([0-9.]+(?:Kb|Mb|b))\s*([0-9.]+(?:Kb|Mb|b))\s*([0-9.]+(?:Kb|Mb|b))', line)
        if not external_match:
            i += 1
            continue
            
        i += 1
        if i >= len(lines):
            break
            
        internal_match = re.search(r'(192\.\d+\.\d+\.\d+)\s*<=\s*([0-9.]+(?:Kb|Mb|b))\s*([0-9.]+(?:Kb|Mb|b))\s*([0-9.]+(?:Kb|Mb|b))', lines[i])
        if not internal_match:
            i += 1
            continue
            
        internal_ip = internal_match.group(1)
        hosts[internal_ip] = {
            'bw_2s_incoming': external_match.group(1),
            'bw_10s_incoming': external_match.group(2),
            'bw_40s_incoming': external_match.group(3),
            'bw_2s_outgoing': internal_match.group(2),
            'bw_10s_outgoing': internal_match.group(3),
            'bw_40s_outgoing': internal_match.group(4)
        }
        
        i += 1
        
    return hosts

data = """# Host name (port/service if enabled)            last 2s   last 10s   last 40s cumulative
--------------------------------------------------------------------------------------------
   1  *                                       =>     10.9Mb     8.70Mb     8.03Mb     14.1MB
     192.168.1.10                             <=      233Kb      199Kb      181Kb      316KB
   2  *                                       =>     8.54Mb     8.32Mb     7.45Mb     13.0MB
     192.168.1.103                            <=     28.1Kb     22.2Kb     19.4Kb     34.0KB
   3  *                                       =>         0b     1.30Mb      952Kb     1.63MB
     192.168.0.98                             <=         0b     39.2Kb     28.0Kb     49.0KB
   4  *                                       =>     34.9Kb     20.0Kb     14.3Kb     25.0KB
     192.168.0.36                             <=      322Kb      146Kb      105Kb      183KB
   5  *                                       =>       512b     38.9Kb     27.8Kb     48.6KB
     192.168.0.137                            <=       576b     6.98Kb     4.99Kb     8.73KB
   6  *                                       =>       672b     6.62Kb     4.86Kb     8.51KB
     192.168.0.44                             <=     1.00Kb     22.5Kb     16.1Kb     28.2KB
   7  *                                       =>     31.6Kb     11.1Kb     7.99Kb     14.0KB
     192.168.1.5                              <=     23.5Kb     9.93Kb     7.12Kb     12.5KB
   8  *                                       =>     7.95Kb     7.16Kb     6.19Kb     10.8KB
     192.168.0.159                            <=     3.70Kb     2.33Kb     1.87Kb     3.27KB
   9  *                                       =>         0b     1.72Kb     1.23Kb     2.15KB
     192.168.0.25                             <=     4.14Kb     7.07Kb     5.64Kb     9.87KB
  10  *                                       =>         0b     1.74Kb     1.24Kb     2.17KB
     192.168.0.56                             <=         0b     2.78Kb     1.99Kb     3.48KB
--------------------------------------------------------------------------------------------"""

result = parse_bandwidth(data)
print(json.dumps(result, indent=2))


