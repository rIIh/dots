import anime from "animejs";
import { useRef, useState, useCallback, useEffect } from "react";
import { debounce } from "debounce";

const useAnime = <StateType extends object>(initialValue: StateType): [StateType, (next: StateType | ((last: StateType) => StateType)) => void, (next: StateType | ((last: StateType) => StateType)) => void] => {
  const ref = useRef(initialValue);
  const [state, setState] = useState(initialValue);
  const [nextState, setNextState] = useState(initialValue);
  const animeInstance = useRef<anime.AnimeInstance>(null);

  const animate = useCallback((next: StateType | ((last: StateType) => StateType)) => {
    const _nextResult = (typeof next == "function" ? (next as (next: StateType) => StateType)(ref.current) : next);
    setNextState(_nextResult);
  }, []);

  useEffect(() => {
    anime.remove(animeInstance.current);
    ref.current = state;
    //@ts-ignore
    animeInstance.current = anime({
      targets: ref.current,
      ...nextState,
      round: 1,
      easing: 'easeOutBack',
      duration: 500,
      update: function() {
        setState(ref.current);
      }
    });
  }, [nextState]);

  return [state, animate, setState]
};

export default useAnime;