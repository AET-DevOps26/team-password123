# Problem Statement

## Main Functionality

The application serves as a nutrition and health companion that automates the calorie and
macro-tracking process. Traditional food logging is often abandoned because it requires manual
searching, weighing, and data entry. This app eliminates that friction by allowing users to log
entire meals simply by capturing or uploading a photo. Beyond logging, it provides long-term
health insights through an analytics dashboard.

## Intended Users


● Health-Conscious Individuals: People looking to maintain a balanced diet without the "data entry" fatigue of traditional apps.

● Athletes & Fitness Enthusiasts: Users who need to monitor specific macronutrient targets (proteins, fats, carbs) to fuel their performance.

● Weight Management Seekers: Those aiming to lose or gain weight who require an easy way to visualize their caloric trends over weeks, months, and years.

## Meaningful GenAI Integration

GenAI is the engine of the app, not just a feature. It is integrated in the following ways:

● **Computer Vision for Food Recognition:** Using Multi-modal LLMs to identify specific food items and estimate portion sizes from a 2D image.

● **Nutritional Inference:** The AI calculates caloric density and breaks down macros (grams of P/C/F) based on the identified ingredients in the photo.

● **Intelligent Estimation:** For complex home-cooked meals where a database might not have a direct match, GenAI "reasons" through the likely ingredients to provide a realistic nutritional estimate.

## Functional Scenarios


● The "Snap and Go" Lunch: A user is at a restaurant and doesn't know the exact ingredients of their salad. They take a quick photo through the app. The AI identifies the quinoa, avocado, and dressing, logs the estimated 550 calories, and updates the user's daily protein goal instantly.

● The Progress Review: On a Sunday evening, a user opens their Personal Account to view the Analytics tab. They review a "Weekly Goal" chart generated from their logged data, seeing that they averaged 2,200 calories and met their fiber targets for the week.

● Manual Refinement: A user makes a protein shake at home. Instead of taking a photo, they use the "Add ingredients manually" feature to quickly type in their specific protein powder and milk, ensuring 100% accuracy for their training logs.


