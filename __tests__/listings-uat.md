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

UAT 11 — Reserve available listing sets reserved_by

Given I am authenticated as a buyer
And an available listing exists that I do not own
When I reserve the listing
Then the listing status should be updated to reserved
And the listing reserved_by field should store my user ID
And the response should confirm the reservation

UAT 12 — Prevent duplicate reservation

Given I am authenticated as a buyer
And the listing has already been reserved by another user
When I try to reserve the same listing
Then the request should be rejected
And the listing reserved_by field should not be changed
And no new reservation should be created

UAT 13 — Search listings by status

Given listings exist with different statuses
When I request /listings/search?status=available
Then only listings with status available should be returned
And reserved or unavailable listings should not be included

UAT 14 — Search listings by reserved buyer

Given I am authenticated as a buyer
And I have reserved one or more listings
When I request /listings/search?status=reserved&reserved_by=myUserId
Then only listings reserved by me should be returned
And listings reserved by other users should not be included

UAT 15 — Search listings returns seller name and ratings

Given listings exist with seller profile and rating information
When I request listings from the search endpoint
Then each listing should include the seller’s name
And each listing should include the seller’s rating data
And the frontend should be able to display the seller name and rating on the listing card