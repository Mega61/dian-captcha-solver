import csv

input_file = 'Free_Proxy_List.txt'  # CSV file with the proxy list
output_file = 'formatted_proxies.txt'  # Output file with the formatted proxies

with open(input_file, newline='', encoding='utf-8') as csvfile, open(output_file, 'w', encoding='utf-8') as outfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        # Get the required fields from the CSV
        ip = row.get('ip', '').strip().strip('"')
        port = row.get('port', '').strip().strip('"')
        protocol = row.get('protocols', '').strip().strip(
            '"')  # using "protocols" per your CSV

        # Format the proxy as: protocol://ip:port
        formatted = f"{protocol}://{ip}:{port}"

        # Write the formatted proxy to the output file and print it
        outfile.write(formatted + "\n")
        print(formatted)
