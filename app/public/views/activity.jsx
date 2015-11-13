import {Map} from 'immutable';
import PureComponent from 'react-pure-render/component';
import React, {PropTypes} from 'react';
import ReactDOM from 'react-dom';
import {connect} from 'react-redux';
import { Link } from 'react-router';
import {throttle} from 'lodash';
import * as actions from '../actions';

import StickyNav from '../partials/sticky-nav';
import ParkMap from '../components/parkMap';
import { helpers } from '../../constants/park-activities';
import Navigator from '../components/navigator';


function mapStateToProps(state) {
  // NOTE: this may or may not be an Immutable JS object
  return Map(state).toJS();
}

export class Activity extends PureComponent {
  static propTypes = {
    params: PropTypes.shape({
      activity: PropTypes.string.isRequired
    }).isRequired,
    selectedActivity: PropTypes.shape({
      parks: PropTypes.array.isRequired,
      isFetching: PropTypes.bool,
      activity: PropTypes.string
    }).isRequired,
    windowSize: PropTypes.object,
    setWindowSize: PropTypes.func,
    clearSelectedActivityData: PropTypes.func,
    fetchSelectedActivity: PropTypes.func
  };

  state = {
    selectedMarker: 0,
    hovered: null
  };

  componentWillMount() {}

  componentDidMount() {
    this.handleResizeThrottled = throttle(this.handleResize, 250).bind(this);
    window.addEventListener('resize', this.handleResizeThrottled);
    this.handleResize();

    if (!this.props.selectedActivity.isFetching) {
      if (Map(this.props.selectedActivity.parks).isEmpty()) {
        this.props.fetchSelectedActivity(this.props.params.activity);
      } else if (this.props.selectedActivity.activity !== this.props.params.activity) {
        this.props.fetchSelectedActivity(this.props.params.activity);
      }
    }
  }

  componentDidUpdate() {
    this.setScrollContainerHeight();
  }

  componentWillUnmount() {
    this.props.clearSelectedActivityData(this.props.params.activity);
    window.removeEventListener('resize', this.handleResizeThrottled);
  }

  getWindowDimensions() {
    // Need to make sure we have a window due to
    // server rendering...
    if (typeof window === 'undefined') return {width: 0, height: 0};

    return {
      width: window.innerWidth,
      height: window.innerHeight
    };
  }

  getHeight() {
    if (this.props.windowSize.height) {
      return this.props.windowSize.height - 76;
    }

    return 700;
  }

  getHalfHeight() {
    const h = this.getHeight();
    return Math.round(h / 2) + 'px';
  }

  setScrollContainerHeight() {
    if (!this.refs.parklist) return;
    const elm = ReactDOM.findDOMNode(this.refs.parklist);
    elm.style.height = (this.props.windowSize.height - elm.offsetTop - 40) + 'px';
  }

  setMarkerIcon(marker, idx) {
    // circle icon path generator:
    // http://complexdan.com/svg-circleellipse-to-path-converter/
    const icon = {
      scale: 1,
      fillOpacity: 1,
      strokeOpacity: 1
    };

    if (idx === this.state.selectedMarker || idx === this.state.hovered) {
      icon.path = 'M-4,0a4,4 0 1,0 8,0a4,4 0 1,0 -8,0';
      icon.fillColor = '#ffffff';
      icon.strokeColor = '#358292';
      icon.strokeWeight = 2;
    } else {
      icon.path = 'M-5,0a5,5 0 1,0 10,0a5,5 0 1,0 -10,0';
      icon.fillColor = '#358292';
      icon.strokeColor = '#358292';
      icon.strokeWeight = 0;
    }
    return icon;
  }

  setMarkerId(marker, idx) {
    return marker.su_id;
  }

  setMarkerPosition(marker, idx) {
    return {lat: marker.centroid.coordinates[1], lng: marker.centroid.coordinates[0]};
  }

  setMarkerZindex(marker, idx) {
    return (this.state.selectedMarker === idx || this.state.hovered === idx) ? 1000 + idx : idx;
  }

  handleResize() {
    this.props.setWindowSize(this.getWindowDimensions());
  }

  onListClick(idx) {
    if (this.state.selectedMarker === idx) return;
    this.setState({selectedMarker: idx});
  }

  onListMouseOver(idx) {
    if (this.state.hovered === idx) return;
    // this.setState({hovered: idx});
  }
  onListMouseOut(idx) {
    if (this.state.hovered !== idx) return;
    // this.setState({hovered: null});
  }

  render() {
    const icon = helpers.iconprefix + this.props.params.activity;
    return (
      <div id='activity' className='container'>
        <main className='page-activity' role='application'>
          <StickyNav className='alt' />
          <div className='row content' style={{height: this.getHeight() + 'px'}}>
            <div className='col-four'>
              <div className='activity-hero'>
                <img src={'/assets/images/activities/' + this.props.params.activity + '_square.jpg'} />
                <div className='activity-logo'>
                  <svg className={'icon alt large park-activity ' + this.props.params.activity}>
                    <use xlinkHref={icon} />
                  </svg>
                  <Link to='/' hash='#discover'>Back to activities</Link>
                </div>
              </div>

              <div className='inset'>
                <h4 className='title uppercase'>{helpers.title(this.props.params.activity)}</h4>

                <ul ref='parklist' className='park-list'>
                {this.props.selectedActivity.parks.map((park, index) => {
                  return (
                    <li
                      key={park.su_id}
                      ref={park.su_id}
                      className={(this.state.selectedMarker === index) ? 'selected' : ''}
                      onClick={this.onListClick.bind(this, index)}
                      onMouseOver={this.onListMouseOver.bind(this, index)}
                      onMouseOut={this.onListMouseOut.bind(this, index)}>
                      {park.su_name}
                    </li>
                  );
                })}
                </ul>
              </div>
            </div>
            <div className='col-eight map-wrap pos-relative'>
              <ParkMap
                markers={this.props.selectedActivity.parks}
                selectedMarker={this.state.selectedMarker}
                setMarkerIcon={this.setMarkerIcon.bind(this)}
                setMarkerId={this.setMarkerId.bind(this)}
                setMarkerPosition={this.setMarkerPosition.bind(this)}
                setMarkerZindex={this.setMarkerZindex.bind(this)} />

              <Navigator
                items={this.props.selectedActivity.parks}
                selectedItem={this.state.selectedMarker}
                nameKey={'su_name'}
                idKey={'su_id'} />
            </div>
          </div>
        </main>
      </div>
    );
  }
}

export const ActivityContainer = connect(mapStateToProps, actions)(Activity);