import React, { useEffect, useState, type ReactNode } from 'react';
import { FaShuffle } from 'react-icons/fa6';
import { BsArrowRepeat } from "react-icons/bs";
import { AiFillStop } from "react-icons/ai";

type Color = 'red' | 'blue' | 'green' | 'yellow' | null;
type CardType = 'number' | 'action' | 'wild';
type ActionValue = 'Skip' | 'Reverse' | 'Draw2';
type WildValue = 'Wild' | 'Wild+4';
type CardValue = number | ActionValue | WildValue | string;

type Card = {
  id: string;
  type: CardType;
  color: Color;
  value: CardValue;
};

type GameState = {
  deck: Card[];
  discard: Card[];
  hands: Card[][];
  currentColor: Color;
  currentPlayerIdx: number;
  direction: 1 | -1;
  gameOver: boolean;
  winner: number | null;
  message: string;
  selectedColor: Color;
  selectedCards: number[]; // indices in player's hand
  skipNextPlayer: boolean;
};

const COLORS: Exclude<Color, null>[] = ['red', 'blue', 'green', 'yellow'];
const ACTION_CARDS: ActionValue[] = ['Skip', 'Reverse', 'Draw2'];
const PLAYERS = ['Joueur 1', 'IA 2', 'IA 3', 'IA 4'];
const PLAYER_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#fbbf24'];

const randId = () => Math.random().toString(36).slice(2, 9);

const generateDeck = (): Card[] => {
  const deck: Card[] = [];

  // Number cards 0-9 (0 once, others twice)
  COLORS.forEach((color) => {
    for (let num = 0; num <= 9; num++) {
      deck.push({ type: 'number', color, value: num, id: randId() });
      if (num !== 0) {
        deck.push({ type: 'number', color, value: num, id: randId() });
      }
    }
  });

  // Action cards (two of each color)
  COLORS.forEach((color) => {
    ACTION_CARDS.forEach((action) => {
      deck.push({ type: 'action', color, value: action, id: randId() });
      deck.push({ type: 'action', color, value: action, id: randId() });
    });
  });

  // Wild cards
  for (let i = 0; i < 4; i++) {
    deck.push({ type: 'wild', color: null, value: 'Wild', id: randId() });
    deck.push({ type: 'wild', color: null, value: 'Wild+4', id: randId() });
  }

  return deck.sort(() => Math.random() - 0.5);
};

const getCardDisplay = (card: Card): string | number | ReactNode => {
  if (card.type === 'number') return card.value as number;
  if (card.value === 'Skip') return <AiFillStop />;
  if (card.value === 'Reverse') return <BsArrowRepeat />;
  if (card.value === 'Draw2') return '+2';
  if (card.value === 'Wild') return '🌈';
  if (card.value === 'Wild+4') return '+4';
  return String(card.value);
};

const getCardColor = (card: Card | undefined): string => {
  if (!card) return '#111827';
  if (card.type === 'wild') return '#1f2937';
  const map: Record<Exclude<Color, null>, string> = {
    red: '#ef4444',
    blue: '#3b82f6',
    green: '#10b981',
    yellow: '#fbbf24',
  };
  return map[(card.color as Exclude<Color, null>) ?? 'red'];
};

const canCardBePlayed = (card: Card | undefined, topCard: Card | undefined, activeColor: Color): boolean => {
  if (!card || !topCard) return false;
  if (card.type === 'wild') return true;
  if (card.color === activeColor) return true;
  if (card.value === topCard.value) return true;
  return false;
};

const canPlayMultipleCards = (cards: Card[], topCard: Card | undefined, activeColor: Color): boolean => {
  if (!cards || cards.length === 0 || !topCard) return false;
  if (cards.length === 1) return canCardBePlayed(cards[0], topCard, activeColor);

  const firstValue = cards[0].value;
  const allSameValue = cards.every((c) => c && c.value === firstValue);

  if (!allSameValue) return false;
  if (!canCardBePlayed(cards[0], topCard, activeColor)) return false;

  return true;
};

const drawCardsFromDeck = (count: number, currentDeck: Card[], currentDiscard: Card[]) => {
  let newDeck = [...currentDeck];
  const drawn: Card[] = [];

  for (let i = 0; i < count; i++) {
    if (newDeck.length === 0) {
      if (currentDiscard.length > 1) {
        // shuffle discard except top
        newDeck = currentDiscard.slice(0, -1).sort(() => Math.random() - 0.5);
      } else {
        break;
      }
    }
    if (newDeck.length > 0) {
      drawn.push(newDeck.pop() as Card);
    }
  }

  return { drawn, newDeck };
};

// Clockwise order mapping used in original: 0 (bottom) → 3 (left) → 1 (top) → 2 (right)
const getNextPlayerIdx = (currentIdx: number, dir: 1 | -1): number => {
  const clockwiseOrder = [0, 3, 1, 2];
  const currentPosition = clockwiseOrder.indexOf(currentIdx);
  const nextPosition = dir === 1 ? (currentPosition + 1) % 4 : (currentPosition - 1 + 4) % 4;
  return clockwiseOrder[nextPosition];
};

// Small presentational component for wild card visuals
const CardWildDisplay: React.FC<{ cardValue: string | number| ReactNode; isSmall?: boolean }> = ({ cardValue, isSmall = false }) => (
  <div className="relative w-full h-full flex items-center justify-center">
    <div className={`relative ${isSmall ? 'w-10 h-10' : 'w-14 h-14'} rounded-full bg-white flex items-center justify-center overflow-hidden`}>
      <div className="absolute w-full h-0.5 bg-black z-10" />
      <div className="absolute h-full w-0.5 bg-black z-10" />
      <div className="grid grid-cols-2 gap-0 w-full h-full">
        <div className="bg-red-500" />
        <div className="bg-yellow-400" />
        <div className="bg-blue-500" />
        <div className="bg-green-500" />
      </div>
    </div>
    {String(cardValue).includes('+4') && (
      <span className="absolute text-white font-bold z-50" style={{ fontSize: isSmall ? '12px' : '16px', textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
        +4
      </span>
    )}
  </div>
);

const CardDisplay: React.FC<{ card: Card; isSmall?: boolean }> = ({ card, isSmall = false }) => {
  if (card.type === 'wild') {
    return <CardWildDisplay cardValue={getCardDisplay(card)} isSmall={isSmall} />;
  }

  const bgColor = getCardColor(card);
  const display = getCardDisplay(card);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className={`relative ${isSmall ? 'w-10 h-10' : 'w-14 h-14'} rounded-full bg-white flex items-center justify-center`}>
        <span className="font-bold" style={{ fontSize: isSmall ? '16px' : '24px', color: bgColor }}>
          {display}
        </span>
      </div>
    </div>
  );
};

const UNO: React.FC = () => {
  const initialState = (): GameState => {
    const newDeck = generateDeck();
    const starter = newDeck.pop() as Card;
    const hands: Card[][] = [[], [], [], []];
    for (let i = 0; i < 4; i++) {
      hands[i] = newDeck.splice(-7);
    }
    return {
      deck: newDeck,
      discard: [starter],
      hands,
      currentColor: (starter.color ?? 'red') as Color,
      currentPlayerIdx: 0,
      direction: 1,
      gameOver: false,
      winner: null,
      message: 'À ton tour !',
      selectedColor: null,
      selectedCards: [],
      skipNextPlayer: false,
    };
  };

  const [gameState, setGameState] = useState<GameState>(initialState);

  const toggleCardSelection = (cardIndex: number) => {
    setGameState((prev) => {
      if (!prev.hands[0][cardIndex]) return prev;

      const isSelected = prev.selectedCards.includes(cardIndex);
      if (isSelected) {
        return {
          ...prev,
          selectedCards: prev.selectedCards.filter((i) => i !== cardIndex),
        };
      } else {
        return {
          ...prev,
          selectedCards: [...prev.selectedCards, cardIndex],
        };
      }
    });
  };

  const handlePlayerPlay = () => {
    if (gameState.currentPlayerIdx !== 0 || gameState.gameOver) return;
    if (gameState.selectedCards.length === 0) return;

    const topCard = gameState.discard[gameState.discard.length - 1];
    const selectedCardObjects = gameState.selectedCards.map((i) => gameState.hands[0][i]).filter(Boolean) as Card[];

    if (selectedCardObjects.length === 0) {
      setGameState((prev) => ({ ...prev, selectedCards: [] }));
      return;
    }

    if (selectedCardObjects.length > 1) {
      const firstValue = selectedCardObjects[0].value;
      const allSameValue = selectedCardObjects.every((c) => c && c.value === firstValue);
      if (!allSameValue) {
        setGameState((prev) => ({ ...prev, selectedCards: [] }));
        return;
      }
    }

    if (!canCardBePlayed(selectedCardObjects[0], topCard, gameState.currentColor)) {
      setGameState((prev) => ({ ...prev, selectedCards: [] }));
      return;
    }

    if (selectedCardObjects[0].type === 'wild' && gameState.selectedColor === null) {
      // must choose color first
      return;
    }

    const newHands = gameState.hands.map((h) => [...h]);
    newHands[0] = gameState.hands[0].filter((_, i) => !gameState.selectedCards.includes(i));

    const newDiscard = [...gameState.discard, ...selectedCardObjects];
    const lastCard = selectedCardObjects[selectedCardObjects.length - 1];

    let newColor: Color = gameState.currentColor;
    if (lastCard.type === 'wild') {
      newColor = gameState.selectedColor;
    } else {
      newColor = lastCard.color;
    }

    if (newHands[0].length === 0) {
      setGameState((prev) => ({
        ...prev,
        gameOver: true,
        winner: 0,
        message: '🎉 Tu as gagné !',
        hands: newHands,
        discard: newDiscard,
        currentColor: newColor,
      }));
      return;
    }

    let nextPlayerIdx = getNextPlayerIdx(0, gameState.direction);
    let skipNext = false;
    let newDirection: 1 | -1 = gameState.direction;

    if (lastCard.value === 'Skip') {
      skipNext = true;
    } else if (lastCard.value === 'Reverse') {
      newDirection = (gameState.direction === 1 ? -1 : 1) as 1 | -1;
      nextPlayerIdx = getNextPlayerIdx(0, newDirection);
    } else if (lastCard.value === 'Draw2') {
      const cardsToDrawCount = selectedCardObjects.filter((c) => c.value === 'Draw2').length * 2;
      const { drawn } = drawCardsFromDeck(cardsToDrawCount, gameState.deck, newDiscard);
      newHands[nextPlayerIdx] = [...newHands[nextPlayerIdx], ...drawn];
    } else if (lastCard.value === 'Wild+4') {
      const cardsToDrawCount = selectedCardObjects.filter((c) => c.value === 'Wild+4').length * 4;
      const { drawn } = drawCardsFromDeck(cardsToDrawCount, gameState.deck, newDiscard);
      newHands[nextPlayerIdx] = [...newHands[nextPlayerIdx], ...drawn];
    }

    setGameState((prev) => ({
      ...prev,
      hands: newHands,
      discard: newDiscard,
      currentColor: newColor,
      currentPlayerIdx: nextPlayerIdx,
      direction: newDirection,
      skipNextPlayer: skipNext,
      message: "Tour de l'IA...",
      selectedColor: null,
      selectedCards: [],
      deck: prev.deck,
    }));
  };

  const handlePlayerDraw = () => {
    if (gameState.currentPlayerIdx !== 0 || gameState.gameOver) return;

    const { drawn, newDeck } = drawCardsFromDeck(1, gameState.deck, gameState.discard);
    const newHands = gameState.hands.map((h) => [...h]);
    newHands[0] = [...newHands[0], ...drawn];

    const nextPlayerIdx = getNextPlayerIdx(0, gameState.direction);

    setGameState((prev) => ({
      ...prev,
      hands: newHands,
      deck: newDeck,
      currentPlayerIdx: nextPlayerIdx,
      message: "Tu as pioché une carte. Tour de l'IA...",
      selectedCards: [],
    }));
  };

  // AI turns
  useEffect(() => {
    if (gameState.currentPlayerIdx === 0 || gameState.gameOver) return;

    const timer = setTimeout(() => {
      const topCard = gameState.discard[gameState.discard.length - 1];
      const currentHand = gameState.hands[gameState.currentPlayerIdx];
      const validCards = currentHand.filter((c) => canCardBePlayed(c, topCard, gameState.currentColor));

      let nextPlayerIdx = getNextPlayerIdx(gameState.currentPlayerIdx, gameState.direction);
      let skipNext = false;
      let newDirection: 1 | -1 = gameState.direction;
      let newHands = gameState.hands.map((h) => [...h]);
      let newDeck = [...gameState.deck];
      let newDiscard = [...gameState.discard];

      if (validCards.length === 0) {
        const { drawn, newDeck: updatedDeck } = drawCardsFromDeck(1, newDeck, newDiscard);
        newHands[gameState.currentPlayerIdx] = [...currentHand, ...drawn];
        newDeck = updatedDeck;
      } else {
        const firstCard = validCards[0];
        const matchingCards = validCards.filter((c) => c.value === firstCard.value);
        const cardsToPlay = matchingCards.length > 1 ? matchingCards : [firstCard];

        newHands[gameState.currentPlayerIdx] = currentHand.filter((card) => !cardsToPlay.includes(card));
        newDiscard = [...newDiscard, ...cardsToPlay];

        let newColor: Color = cardsToPlay[cardsToPlay.length - 1].color;
        if (cardsToPlay[cardsToPlay.length - 1].type === 'wild') {
          newColor = COLORS[Math.floor(Math.random() * 4)];
        }

        const lastCard = cardsToPlay[cardsToPlay.length - 1];

        if (lastCard.value === 'Skip') {
          skipNext = true;
        } else if (lastCard.value === 'Reverse') {
          newDirection = (gameState.direction === 1 ? -1 : 1) as 1 | -1;
          nextPlayerIdx = getNextPlayerIdx(gameState.currentPlayerIdx, newDirection);
        } else if (lastCard.value === 'Draw2') {
          const cardsToDrawCount = cardsToPlay.filter((c) => c.value === 'Draw2').length * 2;
          const { drawn } = drawCardsFromDeck(cardsToDrawCount, newDeck, newDiscard);
          newHands[nextPlayerIdx] = [...newHands[nextPlayerIdx], ...drawn];
        } else if (lastCard.value === 'Wild+4') {
          const cardsToDrawCount = cardsToPlay.filter((c) => c.value === 'Wild+4').length * 4;
          const { drawn } = drawCardsFromDeck(cardsToDrawCount, newDeck, newDiscard);
          newHands[nextPlayerIdx] = [...newHands[nextPlayerIdx], ...drawn];
        }

        if (newHands[gameState.currentPlayerIdx].length === 0) {
          setGameState((prev) => ({
            ...prev,
            gameOver: true,
            winner: gameState.currentPlayerIdx,
            message: `😢 ${PLAYERS[gameState.currentPlayerIdx]} a gagné !`,
            hands: newHands,
            discard: newDiscard,
            currentColor: newColor,
          }));
          return;
        }

        setGameState((prev) => ({
          ...prev,
          hands: newHands,
          discard: newDiscard,
          currentColor: newColor,
          direction: newDirection,
          skipNextPlayer: skipNext,
          deck: newDeck,
        }));
      }

      if (skipNext) {
        nextPlayerIdx = getNextPlayerIdx(nextPlayerIdx, newDirection);
        setGameState((prev) => ({
          ...prev,
          currentPlayerIdx: nextPlayerIdx,
          message: `${PLAYERS[gameState.currentPlayerIdx]} a joué Skip ! ${PLAYERS[nextPlayerIdx]} est passé !`,
          hands: newHands,
          deck: newDeck,
          skipNextPlayer: false,
        }));
      } else {
        setGameState((prev) => ({
          ...prev,
          currentPlayerIdx: nextPlayerIdx,
          message: `À ton tour !`,
          hands: newHands,
          deck: newDeck,
        }));
      }
    }, 1000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.currentPlayerIdx, gameState.gameOver]);

  const resetGame = () => {
    const newDeck = generateDeck();
    const starter = newDeck.pop() as Card;
    const hands: Card[][] = [[], [], [], []];
    for (let i = 0; i < 4; i++) {
      hands[i] = newDeck.splice(-7);
    }
    setGameState({
      deck: newDeck,
      discard: [starter],
      hands,
      currentColor: (starter.color ?? 'red') as Color,
      currentPlayerIdx: 0,
      direction: 1,
      gameOver: false,
      winner: null,
      message: 'À ton tour !',
      selectedColor: null,
      selectedCards: [],
      skipNextPlayer: false,
    });
  };

  const topCard = gameState.discard[gameState.discard.length - 1];
  const canSubmitCards =
    gameState.selectedCards.length > 0 &&
    canPlayMultipleCards(
      gameState.selectedCards.map((i) => gameState.hands[0][i]).filter(Boolean) as Card[],
      topCard,
      gameState.currentColor
    );

  return (
    <div className="min-h-screen bg-linear-to-br from-purple-600 to-indigo-800 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-bold text-center mb-2 text-white">UNO - 4 Joueurs</h1>
        <p className="text-center text-purple-200 mb-4">{gameState.message}</p>
        <p className="text-center text-white mb-6">
          Joueur actuel:{' '}
          <span style={{ color: PLAYER_COLORS[gameState.currentPlayerIdx], fontWeight: 'bold' }}>
            {PLAYERS[gameState.currentPlayerIdx]}
          </span>
          {gameState.direction === -1 && ' (Sens inverse) 🔄'}
        </p>

        {/* Game area */}
        <div className="bg-green-700 rounded-2xl p-8 mb-6">
          {/* Top player (IA 2) */}
          <div className="text-center mb-8">
            <div className="flex justify-center gap-1 flex-wrap mb-2">
              {gameState.hands[1].map((_, idx) => (
                <div key={idx} className="w-10 h-14 bg-purple-800 rounded border border-purple-600" />
              ))}
            </div>
            <p className={`font-bold ${gameState.currentPlayerIdx === 1 ? 'text-white text-lg' : 'text-gray-300'}`}>
              {PLAYERS[1]} ({gameState.hands[1].length})
            </p>
          </div>

          {/* Left and Right players */}
          <div className="flex justify-between mb-8">
            {/* Left player (IA 3) */}
            <div>
              <div className="flex flex-col gap-1 mb-2">
                {gameState.hands[3].map((_, idx) => (
                  <div key={idx} className="w-10 h-14 bg-purple-800 rounded border border-purple-600" />
                ))}
              </div>
              <p className={`font-bold ${gameState.currentPlayerIdx === 3 ? 'text-white text-lg' : 'text-gray-300'}`}>
                {PLAYERS[3]} ({gameState.hands[3].length})
              </p>
            </div>

            {/* Center - Discard pile and deck */}
            <div className="flex justify-center gap-8">
              <div className="relative w-20 h-28">
                {gameState.discard.slice(-3).map((card, idx) => (
                  <div
                    key={idx}
                    className="absolute rounded-lg w-20 h-28 font-bold flex items-center justify-center text-sm"
                    style={{
                      backgroundColor: getCardColor(card),
                      transform: `translateY(${idx * 4}px) rotate(${idx * 5}deg)`,
                    }}
                  >
                    <CardDisplay card={card} isSmall={true} />
                  </div>
                ))}
              </div>

              <button
                onClick={handlePlayerDraw}
                disabled={gameState.currentPlayerIdx !== 0 || gameState.gameOver}
                className="w-20 h-28 bg-blue-600 hover:bg-blue-700 rounded-lg border-4 border-blue-400 flex items-center justify-center text-2xl font-bold disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {gameState.deck.length}
              </button>

              {/* Color selector */}
              {gameState.selectedCards.length > 0 &&
                gameState.hands[0][gameState.selectedCards[0]] &&
                gameState.hands[0][gameState.selectedCards[0]].type === 'wild' && (
                  <div className="flex flex-col gap-2">
                    {COLORS.map((color) => {
                      const colorCodes: Record<Exclude<Color, null>, string> = {
                        red: '#ef4444',
                        blue: '#3b82f6',
                        green: '#10b981',
                        yellow: '#fbbf24',
                      };
                      return (
                        <button
                          key={color}
                          onClick={() => {
                            setGameState((prev) => ({
                              ...prev,
                              selectedColor: color,
                            }));
                          }}
                          className={`w-12 h-12 rounded-full border-2 transition transform hover:scale-110 ${
                            gameState.selectedColor === color ? 'border-white scale-110' : 'border-gray-300'
                          }`}
                          style={{ backgroundColor: colorCodes[color] }}
                        />
                      );
                    })}
                  </div>
                )}
            </div>

            {/* Right player (IA 4) */}
            <div>
              <div className="flex flex-col gap-1 mb-2">
                {gameState.hands[2].map((_, idx) => (
                  <div key={idx} className="w-10 h-14 bg-purple-800 rounded border border-purple-600" />
                ))}
              </div>
              <p className={`font-bold ${gameState.currentPlayerIdx === 2 ? 'text-white text-lg' : 'text-gray-300'}`}>
                {PLAYERS[2]} ({gameState.hands[2].length})
              </p>
            </div>
          </div>

          {/* Bottom player (Player 1) */}
          <div className="flex justify-center gap-2 flex-wrap mb-4">
            {gameState.hands[0].map((card, idx) => (
              <button
                key={card.id}
                onClick={() => toggleCardSelection(idx)}
                className={`rounded-lg font-bold transition transform text-sm w-16 h-24 cursor-pointer border-2 flex items-center justify-center ${
                  gameState.selectedCards.includes(idx)
                    ? 'border-purple-300 scale-110 shadow-lg ring-4 ring-purple-400'
                    : 'border-transparent hover:scale-105 hover:shadow-lg'
                }`}
                style={{ backgroundColor: getCardColor(card) }}
              >
                {card.type === 'wild' ? <CardWildDisplay cardValue={getCardDisplay(card)} /> : <span className="text-white text-2xl">{getCardDisplay(card)}</span>}
              </button>
            ))}
          </div>

          <p className={`text-center font-bold ${gameState.currentPlayerIdx === 0 ? 'text-white' : 'text-gray-400'}`}>{gameState.currentPlayerIdx === 0 ? 'Tes cartes' : ''}</p>

          {/* Play button */}
          {gameState.selectedCards.length > 0 && gameState.currentPlayerIdx === 0 && (
            <div className="flex justify-center gap-4 mt-6">
              <button
                onClick={handlePlayerPlay}
                disabled={
                  !canSubmitCards ||
                  (gameState.hands[0][gameState.selectedCards[0]] &&
                    gameState.hands[0][gameState.selectedCards[0]].type === 'wild' &&
                    !gameState.selectedColor)
                }
                className={`px-6 py-2 rounded-lg font-bold transition ${
                  canSubmitCards &&
                  !(
                    gameState.hands[0][gameState.selectedCards[0]] &&
                    gameState.hands[0][gameState.selectedCards[0]].type === 'wild' &&
                    !gameState.selectedColor
                  )
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-gray-400 text-gray-700 cursor-not-allowed'
                }`}
              >
                Jouer {gameState.selectedCards.length} carte{gameState.selectedCards.length > 1 ? 's' : ''}
              </button>
              <button onClick={() => setGameState((prev) => ({ ...prev, selectedCards: [], selectedColor: null }))} className="px-6 py-2 rounded-lg font-bold bg-red-500 hover:bg-red-600 text-white transition">
                Annuler
              </button>
            </div>
          )}
        </div>

        {/* Color active */}
        <div className="text-center mb-6">
          <p className="text-white font-bold">Couleur active:</p>
          <div
            className="w-8 h-8 rounded mx-auto mt-2"
            style={{
              backgroundColor: {
                red: '#ef4444',
                blue: '#3b82f6',
                green: '#10b981',
                yellow: '#fbbf24',
              }[gameState.currentColor ?? 'red'],
            }}
          />
        </div>

        {/* Game over */}
        {gameState.gameOver && (
          <div className="bg-white rounded-2xl p-8 text-center mb-6">
            <h2 className="text-3xl font-bold mb-4">🎉 {PLAYERS[gameState.winner ?? 0]} a gagné !</h2>
            <button onClick={resetGame} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg transition">
              Nouvelle partie
            </button>
          </div>
        )}

        {!gameState.gameOver && (
          <div className="text-center">
            <button onClick={resetGame} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg transition inline-flex items-center gap-2">
              <FaShuffle size={20} />
              Nouvelle partie
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UNO;
