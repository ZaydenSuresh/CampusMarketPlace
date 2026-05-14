\# SA Data Source for Price Suggestions



\## Source



The price suggestion feature uses Statistics South Africa (Stats SA) Consumer Price Index (CPI) information as the South African market reference source.



Stats SA publishes CPI information for consumer goods and services in South Africa. The CPI basket represents goods and services commonly purchased by South African consumers, so it is suitable as a broad reference for estimating category-based marketplace prices.



Source: Statistics South Africa — Consumer Price Index (CPI)  

URL: https://www.statssa.gov.za/



\## Access Method



The data is accessed manually from Stats SA CPI publications and CPI basket/category information.



For Sprint 4, the Campus Marketplace app does not connect to a live Stats SA API. Instead, selected category averages are stored in the project database table called `price\_suggestions`.



\## Update Frequency



Stats SA publishes CPI releases monthly.



The project’s stored category prices should therefore be reviewed periodically, for example once per semester or once per month.



\## Category Mapping



| Our Category | Source Category / Market Reference | Average Price |

|---|---|---:|

| Textbooks | Education books / student learning materials | R450 |

| Electronics | Household technology / electronic goods | R2500 |

| Furniture | Household furniture | R800 |

| Clothing | Clothing and footwear | R350 |

| Appliances | Household appliances | R1200 |

| Stationary | Education stationery / writing materials | R80 |

| Tickets | Recreation / events | R300 |

| Miscellaneous | General consumer goods | R200 |



\## Suggestion Formula



The system stores a base price for each marketplace category. When a seller selects an item condition, the system applies a condition multiplier.



Formula:



`Suggested Price = Base Price × Condition Multiplier`



Condition multipliers:



| Condition | Multiplier |

|---|---:|

| New | 100% |

| Good | 85% |

| Fair | 70% |

| Worn | 50% |

| Damaged | 30% |



Example:



`Electronics in Good condition = R2500 × 0.85 = R2125`



\## Limitations



The suggested prices are advisory only. Sellers are still allowed to choose their own listing price.



Stats SA CPI data is category-based and does not always provide exact prices for second-hand student items. Some marketplace categories, such as textbooks or tickets, may not match perfectly to CPI categories.



If the source data becomes outdated, the values in the `price\_suggestions` table should be updated manually.

