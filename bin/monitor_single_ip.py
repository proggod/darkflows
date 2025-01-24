#!/usr/bin/env python3
import logging
import re
import sys
import os
import pexpect
import json
import argparse
from pathlib import Path

def get_internal_interface():
    config_path = Path('/etc/darkflows/d_network.cfg')
    try:
        with config_path.open('r') as f:
            for line in f:
                line = line.strip()
                if line.startswith('INTERNAL_INTERFACE='):
                    return line.split('=', 1)[1].strip(' \'"')
            raise ValueError("INTERNAL_INTERFACE not found in config")
    except FileNotFoundError:
        raise ValueError(f"Config file not found at {config_path}")

def parse_arguments():
    parser = argparse.ArgumentParser(description='Monitor bandwidth for specific IP')
    parser.add_argument('ip', help='IP address to monitor')
    return parser.parse_args()

def run_iftop(interface, ip):
    cmd = f'iftop -N -P -B -f "host {ip}" -i {interface} -t -s 3'
    try:
        child = pexpect.spawn(cmd, timeout=15, encoding='utf-8', codec_errors='ignore')
        child.expect(pexpect.EOF)
        return child.before
    except pexpect.ExceptionPexpect as e:
        logging.error(f"pexpect error: {str(e)}")
        raise RuntimeError(f"Failed to execute iftop: {str(e)}")

def parse_iftop_output(output, ip):
    """Parse iftop output for specific IP into structured JSON"""
    data = {
        'target_ip': ip,
        'connections': [],
        'totals': {
            'sent': '0B',
            'received': '0B',
            'cumulative': {
                'sent': '0B',
                'received': '0B',
                'total': '0B'
            }
        },
        'peak_rates': {
            'sent': '0B',
            'received': '0B',
            'total': '0B'
        }
    }
    
    if not output:
        return data
    
    # Connection pattern matching iftop's output format
    conn_pattern = re.compile(
        r'^\s*(\d+)\s+([^\n]+?)\s+=>\s+'
        r'([\d\.]+[KMGB]*)\s+([\d\.]+[KMGB]*)\s+([\d\.]+[KMGB]*)\s+([\d\.]+[KMGB]*)\s*$\n'
        r'^\s+([^\n]+?)\s+<=\s+'
        r'([\d\.]+[KMGB]*)\s+([\d\.]+[KMGB]*)\s+([\d\.]+[KMGB]*)\s+([\d\.]+[KMGB]*)\s*$',
        re.MULTILINE
    )
    
    # Total rates pattern
    total_rates_pattern = re.compile(
        r'Total send rate:\s+([\d\.]+[KMGB]*)\s+([\d\.]+[KMGB]*)\s+([\d\.]+[KMGB]*)\s*\n'
        r'Total receive rate:\s+([\d\.]+[KMGB]*)\s+([\d\.]+[KMGB]*)\s+([\d\.]+[KMGB]*)\s*\n'
        r'Total send and receive rate:\s+([\d\.]+[KMGB]*)\s+([\d\.]+[KMGB]*)\s+([\d\.]+[KMGB]*)',
        re.MULTILINE
    )

    # Peak and cumulative pattern
    peak_cum_pattern = re.compile(
        r'Peak rate \(sent/received/total\):\s+([\d\.]+[KMGB]*)\s+([\d\.]+[KMGB]*)\s+([\d\.]+[KMGB]*)\s*\n'
        r'Cumulative \(sent/received/total\):\s+([\d\.]+[KMGB]*)\s+([\d\.]+[KMGB]*)\s+([\d\.]+[KMGB]*)',
        re.MULTILINE
    )

    try:
        # Process connections
        matches = conn_pattern.findall(output)
        for match in matches:
            data['connections'].append({
                'connection_id': match[0],
                'source': match[1],
                'destination': match[6],
                'sent': {
                    'last_2s': match[2],
                    'last_10s': match[3],
                    'last_40s': match[4],
                    'cumulative': match[5]
                },
                'received': {
                    'last_2s': match[7],
                    'last_10s': match[8],
                    'last_40s': match[9],
                    'cumulative': match[10]
                }
            })

        # Process peak and cumulative rates
        peak_cum_match = peak_cum_pattern.search(output)
        if peak_cum_match:
            data['peak_rates'].update({
                'sent': peak_cum_match.group(1),
                'received': peak_cum_match.group(2),
                'total': peak_cum_match.group(3)
            })
            data['totals']['cumulative'].update({
                'sent': peak_cum_match.group(4),
                'received': peak_cum_match.group(5),
                'total': peak_cum_match.group(6)
            })

    except Exception as e:
        logging.error(f"Parsing error: {str(e)}")
        data['error'] = str(e)

    return data

def main():
    args = parse_arguments()
    logging.basicConfig(level=logging.DEBUG if os.environ.get('DEBUG_IFTOP') else logging.ERROR)
    
    try:
        interface = get_internal_interface()
        output = run_iftop(interface, args.ip)
        parsed = parse_iftop_output(output, args.ip)
        print(json.dumps(parsed, indent=2))
    except Exception as e:
        logging.error(f"Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
