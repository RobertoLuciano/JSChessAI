let board,
    game = new Chess();

let positionCnt = 0;

let onDragStart = 
    (square, piece) =>
        !(game.in_checkmate() || game.in_draw() || /^b/.test(piece))

let highlightSquare = 
    square => document.querySelector(`.square-${square}`).classList.toggle('highlight')

let removeHighlight = 
    () => document.querySelectorAll('.highlight').forEach(el => el.classList.toggle('highlight'))

let onMouseoverSquare =
    (square, piece) => {
        var moves = game.moves({ square, verbose: true }).map(({to}) => to);
        [...moves, square].forEach(highlightSquare)
    }

let onMouseoutSquare = removeHighlight;

let renderHistory = () => document.getElementById("history").innerHTML = `
    ${game.history().map(move => `
        <span>${move}</span>
    `).join('')}
`;

let findBestMoveRandom = () => {
    if (game.game_over()) return alert('Game over!');
    let moves = game.moves();
    return moves[0 | Math.random() * moves.length]
}

let getPieceValue = ({type, color}) => ({
        k: 900,
        q: 90,
        r: 50,
        b: 30,
        n: 30,
        p: 10
    }[type] * {w:-1,b:1}[color]);

let getBoardValue = (board) => {
    return board.reduce(
        (acc, row) => row.reduce((racc, piece) => piece ? racc + getPieceValue(piece) : racc, acc)
        ,0);

}

let getBestMoveBasic = () => {
    let bestValue = -99999;
    let bestMove = null;
    for(let move of game.moves()){
        game.move(move);
        let value = getBoardValue(game.board())
        game.undo()
        if (value > bestValue) {
            bestValue = value
            bestMove = move
        }
    }
    return bestMove;
}

let minimax = (depth, game, maximising) => {
    positionCnt++;
    if (depth == 0) return getBoardValue(game.board());
    var fn = maximising ? Math.max : Math.min;
    var val = maximising ? -Infinity : Infinity;
    for(let move of game.moves()) {
        game.move(move);
        val = fn(val, minimax(depth-1, game, !maximising));
        game.undo()
    }
    return val;
}

let getBestMoveMinimax = () => {
    let bestValue = -Infinity;
    let bestMove = null;
    let time = new Date();
    for(let move of game.moves()){
        game.move(move);
        let value = minimax(+document.getElementById("depth").value, game, false);
        game.undo()
        if (value > bestValue) {
            bestValue = value
            bestMove = move
        }
    }
    let timediff = (new Date() - time) + "ms"
    document.getElementById("time").innerHTML = timediff + "ms"
    document.getElementById("positions").innerHTML =  positionCnt
    document.getElementById("positions_s").innerHTML = (1000 * positionCnt)/timediff
    return bestMove;
}


let minimax_ab = (depth, game, alpha, beta, maximising) => {
    positionCnt++;
    if (depth == 0) return getBoardValue(game.board());
    var fn = maximising ? Math.max : Math.min;
    var val = maximising ? -Infinity : Infinity;
    var update =  maximising ? best => alpha = fn(alpha, best)
                             : best => beta = fn(beta, best);
    for(let move of game.moves()) {
        game.move(move);
        val = fn(val, minimax_ab(depth-1, game, alpha, beta, !maximising));
        game.undo()
        update(val)
        if (beta <= alpha) return val;
    }
    return val;
}

let getBestMoveAlfaBeta = () => {
    let bestValue = -Infinity;
    let bestMove = null;
    let time = new Date();
    positionCnt = 0;
    for(let move of game.moves()){
        game.move(move);
        let value = minimax_ab(+document.getElementById("depth").value - 1, game, -Infinity, Infinity, false);
        game.undo()
        if (value > bestValue) {
            bestValue = value
            bestMove = move
        }
    }
    let timediff = (new Date() - time) + "ms"
    document.getElementById("time").innerHTML = timediff + "ms"
    document.getElementById("positions").innerHTML =  positionCnt
    document.getElementById("positions_s").innerHTML =  (1000 * positionCnt)/timediff
    
    return bestMove;
}

let model;
async function loadModel(){
    model = await tf.loadModel("http://127.0.0.1:8081/models/chess-model-1.json");
    const optimizer = tf.train.sgd(0.01);
    model.compile({
        optimizer: optimizer,
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
    });
}
loadModel()

async function getBestMove() {
    let validMoves = game.moves();
    let state = getBoardState(game.fen());
    const xs = tf.tensor4d(state, [1, 8, 8, 8]);
    let prediction = model.predict(xs);
    let data = await prediction.data();
    data = data.map((v,idx) => validMoves.indexOf(labels[idx]) == -1 ? 0 : v);
    let idx = await tf.argMax(data).data();
    return labels[idx];

}

let findBestMove = () => {
    if (game.game_over()) return alert('Game over!');
    return getBestMove()
}

let makeBestMove = () => {
    findBestMove().then(bestMove => {
        game.move(bestMove);
        board.position(game.fen())
        renderHistory();
    })
}

let onDrop = (from, to) => {
    removeHighlight();
    var move = game.move({from, to, promotion:'q'});
    if (!move) return 'snapback';
    renderHistory();
    window.setTimeout(makeBestMove, 250);

}
let onSnapEnd = () => {
    board.position(game.fen());
}


let config = {
    draggable: true,
    position: 'start',
    onMouseoutSquare,
    onMouseoverSquare,
    onDragStart,
    onDrop,
    onSnapEnd
}

board = ChessBoard('board', config);