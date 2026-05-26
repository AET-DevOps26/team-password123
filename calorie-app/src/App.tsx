import { useState } from 'react';
import { PhotoUpload } from './components/PhotoUpload/PhotoUpload';
import type { Meal, MealAnalysisResponse } from './types';
import './App.css';

export default function App() {
  // Result of the latest analysis (null = nothing analyzed yet or reset)
  const [currentMeal, setCurrentMeal] = useState<Meal | null>(null);

  function handleAnalysisComplete(response: MealAnalysisResponse) {
    setCurrentMeal(response.meal);
  }

  function handleReset() {
    setCurrentMeal(null);
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">🥗 Calorie Counter</h1>
        <p className="app-subtitle">Take a photo of your meal — AI will estimate calories and macros</p>
      </header>

      <main className="app-main">
        {currentMeal === null ? (
          <PhotoUpload onAnalysisComplete={handleAnalysisComplete} />
        ) : (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <h2>{currentMeal.dishName}</h2>
            <p style={{ fontSize: 48, fontWeight: 800, margin: '8px 0' }}>
              {currentMeal.nutrition.calories} <span style={{ fontSize: 18 }}>kcal</span>
            </p>
            <p>Protein {currentMeal.nutrition.protein}g · Fat {currentMeal.nutrition.fat}g · Carbs {currentMeal.nutrition.carbs}g</p>
            <button onClick={handleReset} style={{ marginTop: 24, padding: '10px 24px', cursor: 'pointer' }}>
              ← Analyze another dish
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
