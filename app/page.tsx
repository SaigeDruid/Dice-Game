"use client";

import { useState } from "react";
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Player {
  id: number;
  name: string;
  color: string;
  money: number;
  isActive: boolean;
  dice: Die[];
  rollsUsed: number;
  hasFinished: boolean;
  isWinner: boolean;
}

interface Die {
  value: number;
  held: boolean;
}

const DEFAULT_COLORS = [
  "#EF4444", // red
  "#FFA500", // orange
  "#FFFF00", // yellow
  "#22C55E", // green
  "#3B82F6", // blue
  "#A855F7", // purple
   
];

const DiceIcons = {
  1: Dice1,
  2: Dice2,
  3: Dice3,
  4: Dice4,
  5: Dice5,
  6: Dice6,
};

export default function Home() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerMoney, setNewPlayerMoney] = useState("1000");
  const [newPlayerColor, setNewPlayerColor] = useState(DEFAULT_COLORS[0]);
  const [gameStarted, setGameStarted] = useState(false);
  const [pot, setPot] = useState(0);
  const [roundEnded, setRoundEnded] = useState(false);
  const [anteAmount, setAnteAmount] = useState("50");
  const [showWinnerDialog, setShowWinnerDialog] = useState(false);
  const [winners, setWinners] = useState<Player[]>([]);
  const [winAmount, setWinAmount] = useState(0);
  const { toast } = useToast();

  const addPlayer = () => {
    if (players.length >= 6 || !newPlayerName.trim()) return;
    const money = parseInt(newPlayerMoney) || 1000;
    
    setPlayers([
      ...players,
      {
        id: players.length,
        name: newPlayerName.trim(),
        color: newPlayerColor,
        money,
        isActive: true,
        dice: Array(5).fill({ value: 1, held: false }),
        rollsUsed: 0,
        hasFinished: false,
        isWinner: false,
      },
    ]);
    setNewPlayerName("");
    setNewPlayerMoney("1000");
    setNewPlayerColor(DEFAULT_COLORS[(players.length + 1) % DEFAULT_COLORS.length]);
  };

  const startGame = () => {
    if (players.length < 2) return;
    setGameStarted(true);
    collectAnte();
  };

  const collectAnte = () => {
    const ante = parseInt(anteAmount);
    setPlayers(players.map(player => ({
      ...player,
      money: player.money - ante,
      isActive: player.money >= ante,
      rollsUsed: 0,
      hasFinished: false,
      dice: Array(5).fill({ value: 1, held: false }),
    })));
    setPot(players.length * ante);
  };

  const rollDice = (playerId: number) => {
    const playerData = players[playerId];
    if (!playerData.isActive || playerData.rollsUsed >= 5 || playerData.hasFinished) return;

    // Check if at least one die is held after first roll
    if (playerData.rollsUsed > 0) {
      const hasHeldDie = playerData.dice.some(die => die.held);
      if (!hasHeldDie) return;
    }

    const newDice = playerData.dice.map(die => 
      die.held ? die : { ...die, value: Math.floor(Math.random() * 6) + 1 }
    );

    setPlayers(players.map((player) => 
      player.id === playerId 
        ? { 
            ...player, 
            dice: newDice,
            rollsUsed: player.rollsUsed + 1,
            hasFinished: player.rollsUsed + 1 >= 5
          } 
        : player
    ));

    checkRoundEnd();
  };

  const toggleHold = (playerId: number, dieIndex: number) => {
    const playerData = players[playerId];
    if (playerData.rollsUsed === 0 || playerData.hasFinished) return;

    const newDice = [...playerData.dice];
    const currentlyHeld = newDice[dieIndex].held;

    // If trying to unhold the only held die, prevent it
    if (currentlyHeld && playerData.dice.filter(d => d.held).length === 1) return;

    // If trying to hold a die when none are held, allow it
    newDice[dieIndex] = { ...newDice[dieIndex], held: !currentlyHeld };

    setPlayers(players.map((player) =>
      player.id === playerId ? { ...player, dice: newDice } : player
    ));
  };

  const calculateScore = (dice: Die[]) => {
    return dice.reduce((sum, die) => sum + (die.value === 3 ? 0 : die.value), 0);
  };

  const checkRoundEnd = () => {
    const allFinished = players.every(player => 
      !player.isActive || player.hasFinished || player.rollsUsed >= 5
    );

    if (allFinished) {
      endRound();
    }
  };

  const endRound = () => {
    setRoundEnded(true);

    const scores = players.map(player => ({
      player,
      score: calculateScore(player.dice),
    }));

    const minScore = Math.min(...scores.map(s => s.score));
    const roundWinners = scores
      .filter(s => s.score === minScore)
      .map(s => s.player);
    const prizeAmount = Math.floor(pot / roundWinners.length);

    setPlayers(players.map(player => ({
      ...player,
      money: player.money + (roundWinners.some(w => w.id === player.id) ? prizeAmount : 0),
      dice: player.dice.map(die => ({ ...die, held: false })),
      rollsUsed: 0,
      hasFinished: false,
      isWinner: roundWinners.some(w => w.id === player.id),
    })));

    toast({
      title: "Round Complete!",
      description: `${roundWinners.map(w => w.name).join(", ")} ${roundWinners.length > 1 ? "tie" : "wins"} with ${minScore} points!`,
      duration: 3000,
    });

    setWinners(roundWinners);
    setWinAmount(prizeAmount);
    setPot(0);
    setShowWinnerDialog(true);
    
    // Check if game should end after distributing prizes
    setTimeout(() => {
      checkGameEnd();
    }, 500);
  };

  const startNewRound = () => {
    const anteValue = parseInt(anteAmount);
    const canContinue = players.some(player => player.money >= anteValue);
    
    if (!canContinue) {
      checkGameEnd();
      return;
    }
    
    setShowWinnerDialog(false);
    setRoundEnded(false);
    collectAnte();
  };

  const endGame = () => {
    setShowWinnerDialog(false);
    setGameStarted(false);
    setPlayers([]);
    setPot(0);
    setRoundEnded(false);
    setWinners([]);
    setWinAmount(0);
    setNewPlayerName("");
    setNewPlayerMoney("1000");
    setNewPlayerColor(DEFAULT_COLORS[0]);
    setAnteAmount("50");
  };

  const checkGameEnd = () => {
    const anteValue = parseInt(anteAmount);
    const canContinue = players.some(player => player.money >= anteValue);
    
    if (!canContinue) {
      const winner = [...players].sort((a, b) => b.money - a.money)[0];
      toast({
        title: "Game Over!",
        description: `${winner.name} wins with $${winner.money}!`,
        duration: 5000,
      });
      endGame();
    }
  };

  const DieComponent = ({ value, held, onClick, color, disabled }: { 
    value: number; 
    held: boolean; 
    onClick: () => void; 
    color: string;
    disabled: boolean;
  }) => {
    const DieIcon = DiceIcons[value as keyof typeof DiceIcons];
    return (
      <div
        onClick={disabled ? undefined : onClick}
        className={`cursor-pointer transition-all transform hover:scale-110 ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        style={{ color: held ? color : '#6b7280' }}
      >
        <DieIcon size={48} />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-8">
      {!gameStarted ? (
        <div className="max-w-md mx-auto space-y-4">
          <h1 className="text-4xl font-bold text-center mb-8">Dice Game</h1>
          <div className="space-y-4">
            <div>
              <Label htmlFor="anteAmount">Ante Amount ($)</Label>
              <Input
                id="anteAmount"
                type="number"
                value={anteAmount}
                onChange={(e) => setAnteAmount(e.target.value)}
                min="1"
                step="1"
              />
            </div>
            <div>
              <Label htmlFor="playerName">Player Name</Label>
              <Input
                id="playerName"
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Enter player name"
                maxLength={12}
              />
            </div>
            <div>
              <Label htmlFor="playerMoney">Starting Money ($)</Label>
              <Input
                id="playerMoney"
                type="number"
                value={newPlayerMoney}
                onChange={(e) => setNewPlayerMoney(e.target.value)}
                min="100"
                step="100"
              />
            </div>
            <div>
              <Label htmlFor="playerColor">Player Color</Label>
              <div className="flex gap-2">
                {DEFAULT_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewPlayerColor(color)}
                    className={`w-8 h-8 rounded-full border-2 ${
                      color === newPlayerColor ? 'border-primary' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <Button onClick={addPlayer} disabled={players.length >= 6} className="w-full">
              Add Player
            </Button>
          </div>
          <div className="space-y-2">
            {players.map((player) => (
              <div
                key={player.id}
                className="p-4 rounded flex justify-between items-center"
                style={{ backgroundColor: player.color + "20" }}
              >
                <span style={{ color: player.color }}>{player.name}</span>
                <span>${player.money}</span>
              </div>
            ))}
          </div>
          <Button
            onClick={startGame}
            disabled={players.length < 2}
            className="w-full"
          >
            Start Game
          </Button>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {players.map((player) => (
              <Card
                key={player.id}
                className={cn(
                  "p-4",
                  !player.hasFinished && !roundEnded ? "ring-2" : "",
                  roundEnded && player.isWinner ? "ring-2 ring-yellow-500 dark:ring-yellow-400" : ""
                )}
                style={{ 
                  borderColor: !player.hasFinished && !roundEnded ? player.color : 'transparent'
                }}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3
                      className="text-xl font-bold"
                      style={{ color: player.color }}
                    >
                      {player.name}
                    </h3>
                    <span className="text-lg">${player.money}</span>
                  </div>
                  <div className="flex justify-center space-x-2">
                    {player.dice.map((die, index) => (
                      <DieComponent
                        key={index}
                        value={die.value}
                        held={die.held}
                        onClick={() => toggleHold(player.id, index)}
                        color={player.color}
                        disabled={player.rollsUsed === 0 || player.hasFinished || !player.isActive}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-muted-foreground">
                      Score: {calculateScore(player.dice)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Rolls used: {player.rollsUsed}/5
                    </div>
                  </div>
                  {!roundEnded && (
                    <Button
                      onClick={() => rollDice(player.id)}
                      disabled={player.hasFinished || !player.isActive || 
                        (player.rollsUsed > 0 && !player.dice.some(d => d.held))}
                      className="w-full"
                      style={{ backgroundColor: player.color }}
                    >
                      {player.hasFinished ? 'Finished' : 'Roll Dice'}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-4">Pot: ${pot}</h2>
            {!roundEnded && (
              <Button 
                onClick={endRound}
                className="bg-yellow-500 hover:bg-yellow-600 text-white"
                disabled={!players.some(p => p.rollsUsed > 0)}
              >
                End Round
              </Button>
            )}
          </div>

          <Dialog open={showWinnerDialog} onOpenChange={setShowWinnerDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Trophy className="h-6 w-6 text-yellow-500" />
                  Round Complete!
                </DialogTitle>
                <DialogDescription>
                  {winners.length === 1 ? (
                    <div className="space-y-2">
                      <p>
                        <span style={{ color: winners[0].color }} className="font-bold">
                          {winners[0].name}
                        </span>{" "}
                        wins with a score of {calculateScore(winners[0].dice)}!
                      </p>
                      <p>Prize money: ${winAmount}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p>It's a tie between:</p>
                      <ul className="list-disc list-inside">
                        {winners.map(winner => (
                          <li key={winner.id}>
                            <span style={{ color: winner.color }} className="font-bold">
                              {winner.name}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p>Each winner receives: ${winAmount}</p>
                    </div>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-between mt-4">
                <Button variant="outline" onClick={endGame}>
                  End Game
                </Button>
                <Button onClick={startNewRound}>
                  Play Another Round
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}