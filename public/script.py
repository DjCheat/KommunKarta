from lxml import etree

# Läs in SVG-filen
with open('kommunKarta.svg', 'r', encoding='utf-8') as file:
    svg_data = file.read()

# Parsa SVG-filen
parser = etree.XMLParser(ns_clean=True)
tree = etree.fromstring(svg_data.encode('utf-8'), parser=parser)

# Hitta alla g-element och lägg till data-kommun-attributet för deras polygoner
for g_element in tree.findall('.//{http://www.w3.org/2000/svg}g'):
    kommun_id = g_element.get('id')
    if kommun_id:
        for polygon in g_element.findall('.//{http://www.w3.org/2000/svg}polygon'):
            polygon.set('data-kommun', kommun_id)

# Hitta alla fristående polygon-element och lägg till data-kommun-attributet
for polygon in tree.findall('.//{http://www.w3.org/2000/svg}polygon'):
    kommun_id = polygon.get('id')
    if kommun_id:
        polygon.set('data-kommun', kommun_id)

# Skriv tillbaka den uppdaterade SVG-filen
with open('uppdaterad_kommunKarta.svg', 'wb') as file:
    file.write(etree.tostring(tree, pretty_print=True, encoding='utf-8', xml_declaration=True))

print("SVG-filen har uppdaterats och sparats som 'uppdaterad_kommunKarta.svg'")
