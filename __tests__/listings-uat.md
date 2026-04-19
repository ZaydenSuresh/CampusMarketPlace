UAT 1 — Create listing

Given I am authenticated
When I submit valid listing details and a valid image
Then a new listing should be created
And the response should return the created listing

UAT 2 — Reject unauthenticated listing creation

Given I am not authenticated
When I try to create a listing
Then the request should be rejected

UAT 3 — Validate missing fields on creation

Given I am authenticated
When I submit a listing without title, description, price, or image
Then the listing should not be created
And an error should be returned

UAT 4 — View all listings

Given listings exist
When I request /listings/all
Then I should receive all listings ordered by newest first

UAT 5 — View latest listings

Given listings exist
When I request /listings
Then I should receive the latest 6 listings

UAT 6 — Search listings

Given listings exist
When I search using keyword/category/condition/price filters
Then only matching listings should be returned

UAT 7 — View one listing

Given a listing exists
When I request /listings/:id
Then the correct listing should be returned

UAT 8 — Edit listing

Given I am authenticated and a listing exists
When I send valid updated details
Then the listing should be updated

UAT 9 — Reject invalid update

Given I am authenticated
When I update a listing with an invalid category/condition/sale type
Then the update should be rejected

UAT 10 — Delete listing

Given a listing exists
When I delete it
Then it should be removed successfully