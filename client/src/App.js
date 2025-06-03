import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, 
  Crown, Sword, Home, Building, Gift, MessageCircle, Minus, 
  MapPin, Navigation, Info, Settings
} from 'lucide-react';
import io from 'socket.io-client';

// Game constants
const RESOURCES = {
  WOOD: 'wood',
  BRICK: 'brick', 
  WHEAT: 'wheat',
  SHEEP: 'sheep',
  ORE: 'ore'
};

const BUILDINGS = {
  ROAD: 'road',
  SETTLEMENT: 'settlement', 
  CITY: 'city'
};

const BUILDING_COSTS = {
  [BUILDINGS.ROAD]: { [RESOURCES.WOOD]: 1, [RESOURCES.BRICK]: 1 },
  [BUILDINGS.SETTLEMENT]: { [RESOURCES.WOOD]: 1, [RESOURCES.BRICK]: 1, [RESOURCES.WHEAT]: 1, [RESOURCES.SHEEP]: 1 },
  [BUILDINGS.CITY]: { [RESOURCES.WHEAT]: 2, [RESOURCES.ORE]: 3 }
};

const GAME_PHASES = {
  INITIAL_PLACEMENT: 'initial_placement',
  MAIN_GAME: 'main_game',
  FINISHED: 'finished'
};

// Hex grid geometry helpers
const HEX_SIZE = 45;
const VERTEX_RADIUS = 8;
const EDGE_WIDTH = 4;

const getHexCorners = (centerX, centerY, size = HEX_SIZE) => {
  const corners = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i;
    corners.push({
      x: centerX + size * Math.cos(angle),
      y: centerY + size * Math.sin(angle)
    });
  }
  return corners;
};

const getHexCenter = (row, col) => {
  const x = col * (HEX_SIZE * 1.5) + 250;
  const y = row * (HEX_SIZE * Math.sqrt(3)) + (col % 2) * (HEX_SIZE * Math.sqrt(3) / 2) + 150;
  return { x, y };
};

// Enhanced hex tile component with interactive vertices and edges
const InteractiveHexTile = ({ 
  tile, 
  robberPosition, 
  onTileClick, 
  onVertexClick, 
  onEdgeClick, 
  vertices, 
  edges, 
  buildings,
  currentPlayer,
  gamePhase,
  canPlace
}) => {
  const getResourceColor = (type) => {
    switch(type) {
      case RESOURCES.WOOD: return '#228B22';
      case RESOURCES.BRICK: return '#A0522D'; 
      case RESOURCES.WHEAT: return '#FFD700';
      case RESOURCES.SHEEP: return '#90EE90';
      case RESOURCES.ORE: return '#696969';
      case 'desert': return '#F4A460';
      default: return '#4682B4';
    }
  };

  const getResourceIcon = (type) => {
    switch(type) {
      case RESOURCES.WOOD: return '🌲';
      case RESOURCES.BRICK: return '🧱';
      case RESOURCES.WHEAT: return '🌾';
      case RESOURCES.SHEEP: return '🐑';
      case RESOURCES.ORE: return '⛰️';
      case 'desert': return '🏜️';
      default: return '🌊';
    }
  };

  const center = getHexCenter(tile.row, tile.col);
  const corners = getHexCorners(center.x, center.y);
  const isRobberHere = robberPosition === tile.id;

  // Create hex path
  const hexPath = corners.map((corner, i) => 
    `${i === 0 ? 'M' : 'L'} ${corner.x} ${corner.y}`
  ).join(' ') + ' Z';

  return (
    <g>
      {/* Hex background */}
      <path
        d={hexPath}
        fill={getResourceColor(tile.type)}
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="2"
        style={{ cursor: onTileClick ? 'pointer' : 'default' }}
        onClick={() => onTileClick && onTileClick(tile.id)}
      />
      
      {/* Resource icon */}
      <text
        x={center.x}
        y={center.y - 10}
        textAnchor="middle"
        fontSize="20"
      >
        {getResourceIcon(tile.type)}
      </text>
      
      {/* Number token */}
      {tile.number && (
        <g>
          <circle
            cx={center.x}
            cy={center.y + 10}
            r="12"
            fill="rgba(255,255,255,0.9)"
            stroke={tile.number === 6 || tile.number === 8 ? '#dc2626' : '#374151'}
            strokeWidth="2"
          />
          <text
            x={center.x}
            y={center.y + 15}
            textAnchor="middle"
            fontSize="12"
            fontWeight="bold"
            fill={tile.number === 6 || tile.number === 8 ? '#dc2626' : '#374151'}
          >
            {tile.number}
          </text>
        </g>
      )}
      
      {/* Robber */}
      {isRobberHere && (
        <g>
          <circle cx={center.x} cy={center.y} r="15" fill="#000" />
          <text
            x={center.x}
            y={center.y + 4}
            textAnchor="middle"
            fontSize="16"
          >
            🥷
          </text>
        </g>
      )}
      
      {/* Vertices (settlement/city spots) */}
      {corners.map((corner, i) => {
        const vertexId = `${tile.id}-${i}`;
        const vertex = vertices[vertexId];
        const building = buildings[vertexId];
        const canPlaceHere = canPlace?.vertices?.includes(vertexId);
        
        return (
          <g key={vertexId}>
            {/* Vertex click area */}
            <circle
              cx={corner.x}
              cy={corner.y}
              r={VERTEX_RADIUS}
              fill={
                building 
                  ? building.type === 'settlement' ? '#8B4513' : '#FFD700'
                  : canPlaceHere 
                    ? 'rgba(34, 197, 94, 0.6)' 
                    : 'rgba(156, 163, 175, 0.3)'
              }
              stroke={
                building 
                  ? building.playerColor 
                  : canPlaceHere 
                    ? '#16a34a' 
                    : 'transparent'
              }
              strokeWidth="3"
              style={{ 
                cursor: canPlaceHere ? 'pointer' : 'default',
                transition: 'all 0.2s ease'
              }}
              onClick={() => canPlaceHere && onVertexClick && onVertexClick(vertexId)}
            />
            
            {/* Building icon */}
            {building && (
              <text
                x={corner.x}
                y={corner.y + 3}
                textAnchor="middle"
                fontSize="12"
              >
                {building.type === 'settlement' ? '🏠' : '🏰'}
              </text>
            )}
            
            {/* Placement hint */}
            {canPlaceHere && !building && (
              <text
                x={corner.x}
                y={corner.y + 3}
                textAnchor="middle"
                fontSize="10"
              >
                ➕
              </text>
            )}
          </g>
        );
      })}
      
      {/* Edges (road spots) */}
      {corners.map((corner, i) => {
        const nextCorner = corners[(i + 1) % 6];
        const edgeId = `${tile.id}-${i}`;
        const edge = edges[edgeId];
        const road = buildings[edgeId];
        const canPlaceHere = canPlace?.edges?.includes(edgeId);
        
        const midX = (corner.x + nextCorner.x) / 2;
        const midY = (corner.y + nextCorner.y) / 2;
        
        return (
          <g key={edgeId}>
            {/* Edge line */}
            <line
              x1={corner.x}
              y1={corner.y}
              x2={nextCorner.x}
              y2={nextCorner.y}
              stroke={
                road 
                  ? road.playerColor 
                  : canPlaceHere 
                    ? '#16a34a' 
                    : 'rgba(156, 163, 175, 0.3)'
              }
              strokeWidth={road ? EDGE_WIDTH + 2 : canPlaceHere ? EDGE_WIDTH : 2}
              style={{ 
                cursor: canPlaceHere ? 'pointer' : 'default',
                transition: 'all 0.2s ease'
              }}
              onClick={() => canPlaceHere && onEdgeClick && onEdgeClick(edgeId)}
            />
            
            {/* Road placement hint */}
            {canPlaceHere && !road && (
              <circle
                cx={midX}
                cy={midY}
                r="6"
                fill="rgba(34, 197, 94, 0.8)"
                style={{ cursor: 'pointer' }}
                onClick={() => onEdgeClick && onEdgeClick(edgeId)}
              />
            )}
          </g>
        );
      })}
    </g>
  );
};

// Main game board component
const GameBoard = ({ 
  board, 
  robberPosition, 
  onTileClick, 
  onVertexClick, 
  onEdgeClick,
  vertices,
  edges,
  buildings,
  currentPlayer,
  gamePhase,
  validPlacements
}) => {
  return (
    <div className="bg-gradient-to-b from-blue-400 to-blue-600 rounded-lg p-4 shadow-xl">
      <svg width="500" height="450" viewBox="0 0 500 450">
        {board.map(tile => (
          <InteractiveHexTile
            key={tile.id}
            tile={tile}
            robberPosition={robberPosition}
            onTileClick={onTileClick}
            onVertexClick={onVertexClick}
            onEdgeClick={onEdgeClick}
            vertices={vertices}
            edges={edges}
            buildings={buildings}
            currentPlayer={currentPlayer}
            gamePhase={gamePhase}
            canPlace={validPlacements}
          />
        ))}
      </svg>
    </div>
  );
};

// Enhanced dice component
const DiceComponent = ({ value, isRolling }) => {
  const DiceIcon = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6][value - 1] || Dice1;
  
  return (
    <div className={`w-16 h-16 bg-white rounded-xl shadow-lg flex items-center justify-center transform transition-all duration-300 ${isRolling ? 'animate-bounce' : 'hover:scale-105'}`}>
      <DiceIcon className="w-10 h-10 text-gray-700" />
    </div>
  );
};

// Enhanced resource card
const ResourceCard = ({ type, count, showCount = true }) => {
  const getResourceData = (type) => {
    switch(type) {
      case RESOURCES.WOOD: return { icon: '🌲', color: 'bg-green-600', name: 'Wood' };
      case RESOURCES.BRICK: return { icon: '🧱', color: 'bg-red-600', name: 'Brick' };
      case RESOURCES.WHEAT: return { icon: '🌾', color: 'bg-yellow-500', name: 'Wheat' };
      case RESOURCES.SHEEP: return { icon: '🐑', color: 'bg-green-400', name: 'Sheep' };
      case RESOURCES.ORE: return { icon: '⛰️', color: 'bg-gray-600', name: 'Ore' };
      default: return { icon: '❓', color: 'bg-gray-400', name: 'Unknown' };
    }
  };

  const resource = getResourceData(type);
  
  return (
    <div className={`${resource.color} text-white rounded-lg p-3 min-w-20 text-center shadow-md transform transition-all duration-200 hover:scale-105`}>
      <div className="text-2xl mb-1">{resource.icon}</div>
      {showCount && <div className="text-lg font-bold">{count}</div>}
      <div className="text-xs font-medium">{resource.name}</div>
    </div>
  );
};

// Enhanced player panel
const PlayerPanel = ({ player, isCurrentPlayer, isLocalPlayer }) => {
  return (
    <div className={`bg-white rounded-xl p-4 shadow-lg border-2 transition-all duration-300 ${
      isCurrentPlayer 
        ? 'border-yellow-400 ring-4 ring-yellow-300 ring-opacity-50 transform scale-105' 
        : 'border-gray-200 hover:shadow-xl'
    }`}>
      <div className="flex items-center gap-3 mb-3">
        <div 
          className="w-5 h-5 rounded-full ring-2 ring-white shadow-md"
          style={{ backgroundColor: player.color }}
        />
        <span className="font-bold text-lg">{player.name}</span>
        {isCurrentPlayer && <Crown className="w-5 h-5 text-yellow-500" />}
        {isLocalPlayer && (
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
            You
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">{player.victoryPoints}</div>
          <div className="text-xs text-gray-500">Victory Points</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-blue-600">{player.totalCards}</div>
          <div className="text-xs text-gray-500">Resource Cards</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-green-600">{player.knights}</div>
          <div className="text-xs text-gray-500">Knights</div>
        </div>
      </div>
      
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1">
            <Minus className="w-3 h-3" />
            <span className="font-bold">{player.roads}</span>
          </div>
          <div className="text-gray-500">Roads</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1">
            <Home className="w-3 h-3" />
            <span className="font-bold">{player.settlements}</span>
          </div>
          <div className="text-gray-500">Settlements</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1">
            <Building className="w-3 h-3" />
            <span className="font-bold">{player.cities}</span>
          </div>
          <div className="text-gray-500">Cities</div>
        </div>
      </div>
      
      {(player.hasLongestRoad || player.hasLargestArmy) && (
        <div className="mt-3 space-y-1">
          {player.hasLongestRoad && (
            <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded flex items-center gap-1">
              <Navigation className="w-3 h-3" />
              Longest Road (+2 VP)
            </div>
          )}
          {player.hasLargestArmy && (
            <div className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded flex items-center gap-1">
              <Sword className="w-3 h-3" />
              Largest Army (+2 VP)
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Game phase indicator
const GamePhaseIndicator = ({ gamePhase, currentPlayer, turnPhase, round, maxRounds }) => {
  const getPhaseText = () => {
    if (gamePhase === GAME_PHASES.INITIAL_PLACEMENT) {
      return `Initial Placement - Round ${round}/${maxRounds}`;
    }
    return 'Main Game';
  };

  const getTurnPhaseText = () => {
    switch(turnPhase) {
      case 'place_settlement': return 'Place Settlement';
      case 'place_road': return 'Place Road';
      case 'roll': return 'Roll Dice';
      case 'build': return 'Build Phase';
      case 'robber': return 'Move Robber';
      default: return turnPhase;
    }
  };

  return (
    <div className="bg-white rounded-lg p-4 shadow-lg border-l-4 border-blue-500">
      <div className="flex items-center gap-3">
        <Info className="w-6 h-6 text-blue-500" />
        <div>
          <div className="font-bold text-lg">{getPhaseText()}</div>
          <div className="text-sm text-gray-600">
            {currentPlayer && (
              <>
                <span style={{ color: currentPlayer.color }} className="font-medium">
                  {currentPlayer.name}
                </span>
                {' - '}
                <span className="capitalize">{getTurnPhaseText()}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  // State management
  const [gameState, setGameState] = useState('menu');
  const [players, setPlayers] = useState([]);
  const [localPlayerId, setLocalPlayerId] = useState(null);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [board, setBoard] = useState([]);
  const [dice, setDice] = useState([1, 1]);
  const [isRolling, setIsRolling] = useState(false);
  const [robberPosition, setRobberPosition] = useState(18);
  const [gameLog, setGameLog] = useState([]);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [turnPhase, setTurnPhase] = useState('roll');
  const [socket, setSocket] = useState(null);
  const [gameId, setGameId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [joinGameId, setJoinGameId] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Enhanced game state
  const [gamePhase, setGamePhase] = useState(GAME_PHASES.INITIAL_PLACEMENT);
  const [vertices, setVertices] = useState({});
  const [edges, setEdges] = useState({});
  const [buildings, setBuildings] = useState({});
  const [validPlacements, setValidPlacements] = useState({ vertices: [], edges: [] });
  const [initialPlacementRound, setInitialPlacementRound] = useState(1);

  // Socket connection and event handlers
  useEffect(() => {
    console.log('🔧 Initializing socket connection...');
    
    const getServerUrl = () => {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '10.0.0.3') {
        return 'http://10.0.0.3:3001';
      }
      return `http://${hostname}:3001`;
    };
    
    const serverUrl = getServerUrl();
    console.log('🔗 Connecting to server:', serverUrl);
    
    const newSocket = io(serverUrl);
    
    newSocket.on('connect', () => {
      console.log('✅ Socket connected! ID:', newSocket.id);
      setSocket(newSocket);
      setConnectionStatus('connected');
      setErrorMessage('');
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      setConnectionStatus('disconnected');
    });

    newSocket.on('error', (message) => {
      console.log('🚨 Socket error:', message);
      setErrorMessage(message);
    });

    // Game event handlers
    newSocket.on('game-created', (data) => {
      console.log('🎮 Game created:', data);
      setGameId(data.gameId);
      if (data.gameState.players) {
        const localPlayer = data.gameState.players.find(p => p.id === newSocket.id);
        if (localPlayer) {
          setLocalPlayerId(localPlayer.id);
        }
      }
      updateGameState(data.gameState);
      setGameState('lobby');
    });

    newSocket.on('game-joined', (data) => {
      console.log('🎮 Game joined:', data);
      if (data.players) {
        const localPlayer = data.players.find(p => p.id === newSocket.id);
        if (localPlayer) {
          setLocalPlayerId(localPlayer.id);
        }
      }
      updateGameState(data);
      setGameState('lobby');
    });

    newSocket.on('player-joined', updateGameState);
    newSocket.on('player-left', updateGameState);
    newSocket.on('game-started', updateGameState);
    newSocket.on('game-state-updated', updateGameState);
    newSocket.on('valid-placements', (data) => {
      console.log('📍 Valid placements:', data);
      setValidPlacements(data);
    });

    newSocket.on('chat-message', (message) => {
      setChatMessages(prev => [...prev, message]);
    });

    return () => {
      console.log('🔌 Closing socket connection');
      newSocket.close();
    };
  }, []);

  const updateGameState = (data) => {
    console.log('📊 Updating game state:', data);
    setPlayers(data.players || []);
    setCurrentPlayerIndex(data.currentPlayerIndex || 0);
    setBoard(data.board || []);
    setDice(data.dice || [1, 1]);
    setRobberPosition(data.robberPosition || 18);
    setGameLog(data.gameLog || []);
    setTurnPhase(data.turnPhase || 'roll');
    setGamePhase(data.gamePhase || GAME_PHASES.INITIAL_PLACEMENT);
    setBuildings(data.buildings || {});
    setInitialPlacementRound(data.initialPlacementRound || 1);
    
    if (data.gameState) setGameState(data.gameState);
  };

  const currentPlayer = players[currentPlayerIndex];
  const localPlayer = players.find(p => p.id === localPlayerId);
  const isLocalPlayerTurn = currentPlayer?.id === localPlayerId;

  // Game actions
  const createGame = () => {
    if (!playerName.trim() || !socket) return;
    socket.emit('create-game', { playerName: playerName.trim() });
  };

  const joinGame = () => {
    if (!playerName.trim() || !joinGameId.trim() || !socket) return;
    socket.emit('join-game', { gameId: joinGameId.trim(), playerName: playerName.trim() });
  };

  const startGame = () => {
    if (!socket) return;
    socket.emit('start-game');
  };

  const rollDice = useCallback(() => {
    if (!isLocalPlayerTurn || turnPhase !== 'roll' || !socket) return;
    setIsRolling(true);
    socket.emit('roll-dice');
    setTimeout(() => setIsRolling(false), 1000);
  }, [isLocalPlayerTurn, turnPhase, socket]);

  const placeBuilding = (type, position) => {
    if (!isLocalPlayerTurn || !socket) return;
    socket.emit('place-building', { type, position });
  };

  const moveRobber = (tileId) => {
    if (!isLocalPlayerTurn || turnPhase !== 'robber' || !socket) return;
    socket.emit('move-robber', { tileId });
  };

  const endTurn = () => {
    if (!isLocalPlayerTurn || !socket) return;
    socket.emit('end-turn');
  };

  const sendChatMessage = () => {
    if (!chatInput.trim() || !socket) return;
    socket.emit('chat-message', { message: chatInput });
    setChatInput('');
  };

  const canAfford = (cost) => {
    if (!localPlayer) return false;
    return Object.entries(cost).every(([resource, amount]) => 
      (localPlayer.resources[resource] || 0) >= amount
    );
  };

  const canCreateGame = playerName.trim() && connectionStatus === 'connected';
  const canJoinGame = playerName.trim() && joinGameId.trim() && connectionStatus === 'connected';

  // Menu Interface
  if (gameState === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-cyan-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-md w-full transform transition-all duration-300 hover:scale-105">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Settlers of Catan</h1>
            <p className="text-gray-600">Multiplayer Strategy Game</p>
          </div>
          
          <div className="text-center mb-6">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              connectionStatus === 'connected' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
              }`} />
              {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
            </div>
          </div>
          
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {errorMessage}
            </div>
          )}
          
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="w-full p-4 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              maxLength={20}
            />
            
            <button
              onClick={createGame}
              disabled={!canCreateGame}
              className={`w-full py-4 px-6 rounded-lg text-lg font-semibold transition-all duration-200 ${
                canCreateGame
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              🏝️ Create New Game
            </button>
            
            <div className="text-center text-gray-400 font-medium">or</div>
            
            <input
              type="text"
              placeholder="Enter Game ID"
              value={joinGameId}
              onChange={(e) => setJoinGameId(e.target.value.toUpperCase())}
              className="w-full p-4 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
            />
            
            <button
              onClick={joinGame}
              disabled={!canJoinGame}
              className={`w-full py-4 px-6 rounded-lg text-lg font-semibold transition-all duration-200 ${
                canJoinGame
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              🚀 Join Game
            </button>
          </div>
          
          <div className="mt-8 text-center text-sm text-gray-500 space-y-1">
            <p>🎯 Strategy • 🎲 Dice • 🏆 Victory</p>
            <p>For 3-6 players on the same network</p>
          </div>
        </div>
      </div>
    );
  }

  // Lobby Interface
  if (gameState === 'lobby') {
    const isHost = players.length > 0 && players[0].id === localPlayerId;
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-500 via-blue-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-2xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Game Lobby</h1>
            <p className="text-gray-600">Waiting for players to join</p>
          </div>
          
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-xl mb-8 text-center">
            <div className="text-4xl font-mono font-bold text-blue-800 mb-2 tracking-wider">
              {gameId}
            </div>
            <div className="text-sm text-blue-600 font-medium">
              📱 Share this Game ID with other players
            </div>
          </div>
          
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800">
                Players ({players.length}/6)
              </h3>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Users className="w-4 h-4" />
                Need 3+ to start
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {players.map((player, index) => (
                <div key={player.id} className="bg-gray-50 rounded-lg p-4 flex items-center gap-4">
                  <div 
                    className="w-6 h-6 rounded-full ring-2 ring-white shadow-md"
                    style={{ backgroundColor: player.color }}
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">{player.name}</div>
                    <div className="text-sm text-gray-500">Player {index + 1}</div>
                  </div>
                  <div className="flex gap-2">
                    {index === 0 && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-medium">
                        👑 Host
                      </span>
                    )}
                    {player.id === localPlayerId && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">
                        You
                      </span>
                    )}
                  </div>
                </div>
              ))}
              
              {Array.from({ length: 6 - players.length }).map((_, i) => (
                <div key={`empty-${i}`} className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex items-center justify-center text-gray-400">
                  <Users className="w-6 h-6 mr-2" />
                  Waiting for player...
                </div>
              ))}
            </div>
          </div>
          
          <div className="space-y-4">
            {isHost && (
              <button
                onClick={startGame}
                disabled={players.length < 3}
                className={`w-full py-4 px-6 rounded-lg text-lg font-semibold transition-all duration-200 ${
                  players.length >= 3
                    ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {players.length < 3 ? '⏳ Need at least 3 players' : '🚀 Start Game!'}
              </button>
            )}
            
            {!isHost && (
              <div className="text-center py-4 text-gray-600 bg-gray-50 rounded-lg">
                ⏳ Waiting for host to start the game...
              </div>
            )}
            
            <button
              onClick={() => setGameState('menu')}
              className="w-full py-3 px-6 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-all duration-200"
            >
              ← Leave Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main Game Interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 via-blue-500 to-purple-600 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-800">Settlers of Catan</h1>
              <div className="text-sm font-mono bg-gray-100 px-3 py-1 rounded">
                Game: {gameId}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowChat(!showChat)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all duration-200"
              >
                <MessageCircle className="w-4 h-4" />
                Chat
              </button>
              <div className="text-sm text-gray-600">
                Turn: <span className="font-bold" style={{ color: currentPlayer?.color }}>
                  {currentPlayer?.name}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Left sidebar - Players */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white">Players</h3>
            {players.map(player => (
              <PlayerPanel
                key={player.id}
                player={player}
                isCurrentPlayer={currentPlayerIndex === players.indexOf(player)}
                isLocalPlayer={player.id === localPlayerId}
              />
            ))}
          </div>

          {/* Main game area */}
          <div className="xl:col-span-2 space-y-6">
            {/* Game phase indicator */}
            <GamePhaseIndicator
              gamePhase={gamePhase}
              currentPlayer={currentPlayer}
              turnPhase={turnPhase}
              round={initialPlacementRound}
              maxRounds={2}
            />
            
            {/* Game board */}
            <GameBoard 
              board={board} 
              robberPosition={robberPosition}
              onTileClick={turnPhase === 'robber' ? moveRobber : null}
              onVertexClick={(vertexId) => {
                if (turnPhase === 'place_settlement') {
                  placeBuilding('settlement', vertexId);
                } else if (turnPhase === 'build' && canAfford(BUILDING_COSTS[BUILDINGS.SETTLEMENT])) {
                  placeBuilding('settlement', vertexId);
                } else if (turnPhase === 'build' && canAfford(BUILDING_COSTS[BUILDINGS.CITY])) {
                  placeBuilding('city', vertexId);
                }
              }}
              onEdgeClick={(edgeId) => {
                if (turnPhase === 'place_road') {
                  placeBuilding('road', edgeId);
                } else if (turnPhase === 'build' && canAfford(BUILDING_COSTS[BUILDINGS.ROAD])) {
                  placeBuilding('road', edgeId);
                }
              }}
              vertices={vertices}
              edges={edges}
              buildings={buildings}
              currentPlayer={currentPlayer}
              gamePhase={gamePhase}
              validPlacements={validPlacements}
            />
            
            {/* Dice and turn controls */}
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <span className="text-lg font-semibold">Dice:</span>
                  <DiceComponent value={dice[0]} isRolling={isRolling} />
                  <DiceComponent value={dice[1]} isRolling={isRolling} />
                  <div className="ml-4 text-xl font-bold text-gray-700">
                    Total: {dice[0] + dice[1]}
                  </div>
                </div>
                
                {isLocalPlayerTurn && (
                  <div className="flex gap-3">
                    {turnPhase === 'roll' && (
                      <button
                        onClick={rollDice}
                        disabled={isRolling}
                        className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 ${
                          isRolling
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl'
                        } text-white`}
                      >
                        🎲 Roll Dice
                      </button>
                    )}
                    
                    {(turnPhase === 'build' || (gamePhase === GAME_PHASES.MAIN_GAME && turnPhase !== 'roll' && turnPhase !== 'robber')) && (
                      <button
                        onClick={endTurn}
                        className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                      >
                        End Turn
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              {turnPhase === 'robber' && isLocalPlayerTurn && (
                <div className="text-center p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 font-semibold text-lg">
                    🥷 Robber activated! Click on a hex to move the robber
                  </p>
                </div>
              )}
              
              {gamePhase === GAME_PHASES.INITIAL_PLACEMENT && isLocalPlayerTurn && (
                <div className="text-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-blue-800 font-semibold">
                    {turnPhase === 'place_settlement' && '🏠 Click on a vertex to place your settlement'}
                    {turnPhase === 'place_road' && '🛤️ Click on an edge to place your road'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar - Resources and actions */}
          <div className="space-y-6">
            {/* Local player resources */}
            {localPlayer && (
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <h3 className="text-xl font-bold mb-4">Your Resources</h3>
                <div className="grid grid-cols-1 gap-3">
                  {Object.values(RESOURCES).map(resource => (
                    <ResourceCard 
                      key={resource} 
                      type={resource} 
                      count={localPlayer.resources[resource] || 0}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Building actions */}
            {isLocalPlayerTurn && gamePhase === GAME_PHASES.MAIN_GAME && turnPhase === 'build' && (
              <div className="bg-white rounded-xl p-6 shadow-lg">
                <h3 className="text-xl font-bold mb-4">Build</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => {/* Building will be placed via board click */}}
                    disabled={!canAfford(BUILDING_COSTS[BUILDINGS.ROAD])}
                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 flex items-center gap-3 ${
                      canAfford(BUILDING_COSTS[BUILDINGS.ROAD])
                        ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-md hover:shadow-lg'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Minus className="w-5 h-5" />
                    Road (🌲 + 🧱)
                  </button>
                  
                  <button
                    onClick={() => {/* Building will be placed via board click */}}
                    disabled={!canAfford(BUILDING_COSTS[BUILDINGS.SETTLEMENT])}
                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 flex items-center gap-3 ${
                      canAfford(BUILDING_COSTS[BUILDINGS.SETTLEMENT])
                        ? 'bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Home className="w-5 h-5" />
                    Settlement
                  </button>
                  
                  <button
                    onClick={() => {/* Building will be placed via board click */}}
                    disabled={!canAfford(BUILDING_COSTS[BUILDINGS.CITY]) || !localPlayer || localPlayer.settlements === 0}
                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 flex items-center gap-3 ${
                      (canAfford(BUILDING_COSTS[BUILDINGS.CITY]) && localPlayer && localPlayer.settlements > 0)
                        ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-md hover:shadow-lg'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Building className="w-5 h-5" />
                    City (🌾🌾 + ⛰️⛰️⛰️)
                  </button>
                  
                  <button
                    disabled={!canAfford({ wheat: 1, sheep: 1, ore: 1 })}
                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200 flex items-center gap-3 ${
                      canAfford({ wheat: 1, sheep: 1, ore: 1 })
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Gift className="w-5 h-5" />
                    Dev Card (🌾 + 🐑 + ⛰️)
                  </button>
                </div>
              </div>
            )}
            
            {/* Game log */}
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <h3 className="text-xl font-bold mb-4">Game Log</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {gameLog.map((entry, index) => (
                  <div key={index} className="text-sm text-gray-700 p-2 bg-gray-50 rounded">
                    {entry}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat modal */}
      {showChat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-96">
            <h3 className="text-xl font-bold mb-4">Game Chat</h3>
            <div className="border rounded-lg p-3 h-48 overflow-y-auto mb-4 space-y-2 bg-gray-50">
              {chatMessages.map(msg => (
                <div key={msg.id} className="text-sm">
                  <span className="font-medium" style={{ color: players.find(p => p.id === msg.playerId)?.color }}>
                    {msg.playerName}:
                  </span>
                  <span className="ml-2">{msg.message}</span>
                  <span className="text-gray-400 text-xs ml-2">{msg.timestamp}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                placeholder="Type a message..."
                className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={sendChatMessage}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all duration-200"
              >
                Send
              </button>
            </div>
            <button
              onClick={() => setShowChat(false)}
              className="w-full mt-3 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg transition-all duration-200"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;