const BASE_URL = 'http://localhost:5000/api';

async function runP14Checks() {
  console.log('====================================================');
  console.log('       RUNNING P14 PRODUCT SEARCH CHECKS            ');
  console.log('====================================================\n');

  // 1. Test GET /api/products/suggest?q=sh
  console.log('TEST 1: Suggest endpoint with query (?q=sh)...');
  const res1 = await fetch(`${BASE_URL}/products/suggest?q=sh`);
  if (res1.status !== 200) throw new Error(`Expected status 200, got ${res1.status}`);
  const json1: any = await res1.json();
  console.log('  Status:', res1.status);
  console.log('  Suggestions returned:', json1.data.length);
  json1.data.forEach((item: any, idx: number) => {
    console.log(`   [${idx + 1}] ${item.name} (${item.slug}) - $${item.discountPrice || item.basePrice}`);
  });
  if (!Array.isArray(json1.data) || json1.data.length === 0 || json1.data.length > 5) {
    throw new Error(`Expected between 1 and 5 suggestions, got ${json1.data.length}`);
  }
  console.log('  ✔ PASS: Suggest endpoint returned relevant matches.\n');

  // 2. Test GET /api/products/suggest with empty / missing query
  console.log('TEST 2: Suggest endpoint with empty query (?q=)...');
  const resEmpty = await fetch(`${BASE_URL}/products/suggest?q=`);
  if (resEmpty.status !== 200) throw new Error(`Expected status 200, got ${resEmpty.status}`);
  const jsonEmpty: any = await resEmpty.json();
  console.log('  Status:', resEmpty.status);
  console.log('  Data length:', jsonEmpty.data.length);
  if (!Array.isArray(jsonEmpty.data) || jsonEmpty.data.length !== 0) {
    throw new Error('Expected empty array for empty suggestion query');
  }
  console.log('  ✔ PASS: Empty query returns empty array without error.\n');

  // 3. Test GET /api/products?q=hoodie
  console.log('TEST 3: Full products search query (?q=hoodie)...');
  const resSearch = await fetch(`${BASE_URL}/products?q=hoodie`);
  if (resSearch.status !== 200) throw new Error(`Expected status 200, got ${resSearch.status}`);
  const jsonSearch: any = await resSearch.json();
  const searchData = jsonSearch.data;
  console.log(`  Items found: ${searchData.total}`);
  searchData.items.forEach((p: any) => {
    console.log(`   - ${p.name}`);
  });
  if (searchData.total === 0) {
    throw new Error('Expected products matching "hoodie" to be found');
  }
  console.log('  ✔ PASS: Search query returned matching active products.\n');

  // 4. Test GET /api/products?q=nonexistentqueryxyz
  console.log('TEST 4: Search query with 0 results (?q=nonexistentqueryxyz)...');
  const resZero = await fetch(`${BASE_URL}/products?q=nonexistentqueryxyz`);
  if (resZero.status !== 200) throw new Error(`Expected status 200, got ${resZero.status}`);
  const jsonZero: any = await resZero.json();
  console.log('  Total returned:', jsonZero.data.total);
  if (jsonZero.data.total !== 0 || jsonZero.data.items.length !== 0) {
    throw new Error('Expected 0 results for non-matching query');
  }
  console.log('  ✔ PASS: Zero-match search handled cleanly with total=0.\n');

  console.log('====================================================');
  console.log('       🎉 ALL P14 SEARCH CHECKS PASSED!             ');
  console.log('====================================================');
}

runP14Checks().catch((err) => {
  console.error('\n❌ P14 Check Failed:', err.message);
  process.exit(1);
});
